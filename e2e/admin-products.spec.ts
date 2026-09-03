import { test, expect, type TestInfo } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

// Réutilise la session administrateur écrite une seule fois par e2e/auth.setup.ts (voir
// playwright.config.ts, projet `setup`) plutôt que de se reconnecter via l'écran de
// connexion dans chaque test : aucun de ces tests ne vérifie le parcours de connexion
// lui-même (contrairement à e2e/admin-auth.spec.ts, qui continue de se connecter en
// direct) — Correctif 6 de la revue de la tâche 11, pour ne plus saturer le compartiment
// de limitation de débit partagé de /sign-in/email (voir src/server/auth.ts).
test.use({ storageState: path.join(__dirname, '.auth', 'admin.json') })

// L'intermittence de ce fichier (un 404 après la redirection vers la fiche, un P2025 dans
// creerDeclinaison sur un identifiant pourtant fraîchement créé) venait de son nettoyage,
// pas du serveur : `test.afterAll` s'exécute UNE FOIS PAR WORKER (documenté — voir
// node_modules/playwright/types/test.d.ts, « Declares an afterAll hook that is executed
// once per worker after all tests »), et ce hook supprimait LES DEUX produits de test quel
// que soit le test que ce worker avait réellement joué. Sous `fullyParallel: true`, le
// worker du test le plus rapide — celui qui refuse un prix négatif, qui ne crée rien —
// finissait le premier et supprimait les produits pendant que les autres workers s'en
// servaient. Chaque test possède désormais SON propre slug, dérivé de son titre, et ne
// nettoie que ce qu'il a lui-même créé : plus aucun worker ne touche aux données d'un
// autre, et la suite s'exécute en parallélisme normal.

const prisma = new PrismaClient()

// Slug propre à chaque test, dérivé de son identité (Playwright passe `TestInfo` aux hooks
// comme au corps du test — voir node_modules/playwright/types/test.d.ts) : deux tests ne
// peuvent plus se disputer la même ligne, et le nettoyage d'un test ne peut plus atteindre
// le produit d'un autre. `repeatEachIndex` fait partie de cette identité : sans lui,
// `--repeat-each=N` ferait tourner N copies du même test en parallèle sur le même slug —
// exactement le partage de données que ce correctif supprime. Il n'apparaît qu'au-delà de
// la première répétition, pour garder des slugs lisibles en base lors d'une exécution
// ordinaire.
function testSlug(testInfo: TestInfo): string {
  const identity = testInfo.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  const repeat = testInfo.repeatEachIndex > 0 ? `-r${testInfo.repeatEachIndex}` : ''
  return `e2e-${identity}${repeat}`
}

// Dupliqué plutôt qu'importé de src/server/media.ts : même choix que
// tests/server/media.test.ts (fichierPour/LARGEURS_TEST), pour ne pas faire dépendre ce
// fichier e2e de la résolution de l'alias `@/*` par le test runner Playwright.
const WIDTHS = [400, 800, 1200] as const

async function deleteTestMediaFiles(mediaPath: string) {
  const publicRoot = path.join(process.cwd(), 'public')
  const files = WIDTHS.flatMap((width) =>
    (['avif', 'webp'] as const).map((extension) =>
      path.join(publicRoot, `${mediaPath}-${width}.${extension}`),
    ),
  )
  await Promise.all(files.map((file) => rm(file, { force: true })))
}

// Supprime un produit de test avec tout ce qui en dépend : ses fichiers média sur disque
// (processImage() les écrit hors de la base, la cascade Prisma sur Media ne les efface
// pas), puis le produit lui-même (cascade Prisma sur Variant/Media), puis les lignes de
// journal d'audit qui le référencent — sans quoi elles resteraient orphelines après coup
// (Correctif 8 de la revue de la tâche 11 : « résidus d'audit »).
//
// Tolère intégralement l'absence : `findUnique` puis `delete` n'est pas atomique, et rien
// n'interdit à deux passes de nettoyage (celle d'avant le test, celle d'après) de se
// croiser. `deleteMany` supprime zéro ligne sans broncher là où `delete` lèverait P2025,
// et `rm(force: true)` ignore un fichier déjà effacé.
async function cleanUpTestProduct(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { variants: true, media: true },
  })
  if (!product) return

  await Promise.all(product.media.map((media) => deleteTestMediaFiles(media.path)))

  const entityIds = [product.id, ...product.variants.map((v) => v.id), ...product.media.map((m) => m.id)]
  await prisma.product.deleteMany({ where: { id: product.id } })
  await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } })
}

// Avant : rattrape une exécution précédente tuée sans laisser tourner son `afterEach`
// (Ctrl-C, crash du worker), sans quoi la contrainte d'unicité du slug ferait échouer la
// création au lieu de rejouer le scénario. Après : nettoie ce que ce test vient de créer.
// Les deux ne touchent QUE le slug de ce test.
test.beforeEach(async ({}, testInfo) => {
  await cleanUpTestProduct(testSlug(testInfo))
})

test.afterEach(async ({}, testInfo) => {
  await cleanUpTestProduct(testSlug(testInfo))
})

// Une connexion Prisma par worker : celle-ci, en revanche, est bien une ressource du
// worker et se ferme légitimement une fois par worker.
test.afterAll(async () => {
  await prisma.$disconnect()
})

test('création d\'un produit', async ({ page }, testInfo) => {
  await page.goto('/admin/produits')
  await page.getByRole('link', { name: 'Nouveau produit' }).click()

  await page.getByLabel('Nom').fill('Bracelet Soleil')
  await page.getByLabel('Slug').fill(testSlug(testInfo))
  await page.getByLabel('Description').fill('Acier inoxydable plaqué or 18k.')
  // "Prix" est aussi une sous-chaîne de "Prix d'achat" : correspondance exacte requise pour
  // ne viser que le bon champ.
  await page.getByLabel('Prix', { exact: true }).fill('38000')
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  // creerProduit redirige vers la fiche du produit créé (pas vers la liste) : la propriétaire
  // peut y ajouter des photos dans la foulée sans repasser par la liste. Locator ciblé sur
  // le titre (plutôt que getByText, trop large) : le lecteur de route de Next.js
  // (#__next-route-announcer__) répète aussi ce texte après une navigation côté client.
  await expect(page.getByRole('heading', { name: 'Bracelet Soleil' })).toBeVisible()
})

test('le formulaire refuse un prix négatif', async ({ page }) => {
  await page.goto('/admin/produits/nouveau')
  await page.getByLabel('Prix', { exact: true }).fill('-100')
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(page.getByText('Le prix doit être positif')).toBeVisible()
})

// Vérification réelle du critère d'acceptation n°7 de la V1.0 (« créer un produit avec
// déclinaisons et photos ») : avant le Correctif 3 de la revue de la tâche 11, aucune
// action ne créait de déclinaison, donc aucun parcours n'atteignait ce critère — un produit
// créé depuis l'interface n'avait ni stock ni prix vendable.
test('création d\'un produit avec déclinaison et photo (critère d\'acceptation n°7)', async ({
  page,
}, testInfo) => {
  await page.goto('/admin/produits/nouveau')
  await page.getByLabel('Nom').fill('Collier Étoile')
  await page.getByLabel('Slug').fill(testSlug(testInfo))
  await page.getByLabel('Description').fill('Collier en argent massif, pendentif étoile.')
  await page.getByLabel('Prix', { exact: true }).fill('45000')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('heading', { name: 'Collier Étoile' })).toBeVisible()

  // Déclinaison : libellé, SKU, écart de prix (peut être négatif), stock.
  await page.getByLabel('Libellé').fill('Taille unique')
  // SKU dérivé lui aussi de l'identité du test : la contrainte d'unicité sur `sku` est
  // GLOBALE (voir prisma/schema.prisma), pas limitée au produit — une valeur littérale
  // partagée redeviendrait une donnée commune entre deux exécutions concurrentes.
  const sku = testSlug(testInfo).toUpperCase()
  await page.getByLabel('SKU').fill(sku)
  await page.getByLabel('Écart de prix').fill('-2000')
  await page.getByLabel('Stock').fill('7')
  await page.getByRole('button', { name: 'Ajouter la déclinaison' }).click()

  await expect(page.getByText('Taille unique')).toBeVisible()
  await expect(page.getByText(sku)).toBeVisible()
  // 45 000 - 2 000 = 43 000 Ar. formatAriary (src/domain/money.ts) separe les groupes par
  // une espace insecable (U+00A0), pas une espace ordinaire : \s dans la regex couvre les
  // deux plutot que de deviner laquelle le rendu produit.
  await expect(page.getByText(/43\s*000\s*Ar/)).toBeVisible()

  // Photo : une image JPEG générée en mémoire (aucune fixture binaire versionnée).
  const image = await sharp({
    create: { width: 1000, height: 800, channels: 3, background: '#EDE5DA' },
  })
    .jpeg()
    .toBuffer()

  await page
    .getByLabel('Ajouter une photo')
    .setInputFiles({ name: 'collier-etoile.jpg', mimeType: 'image/jpeg', buffer: image })
  await page.getByRole('button', { name: 'Téléverser' }).click()

  await expect(page.getByText('Photo principale')).toBeVisible()
})
