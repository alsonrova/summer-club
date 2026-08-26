import { test, expect } from '@playwright/test'
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

// Les trois tests de ce fichier créent chacun un produit puis interagissent, dans la
// foulée de la redirection qui suit, avec une Server Action liée (`.bind(null, id)`) à ce
// produit précis. Constaté empiriquement (Correctif 6/7 de la revue de la tâche 11, après
// avoir retiré le plafond global à 2 workers) : exécutés en vraie concurrence sous `next
// start` avec `output: 'standalone'` (voir l'avertissement « next start does not work
// with output: standalone configuration », déjà présent avant cette tâche — hors
// périmètre de ce correctif), ce motif précis (créer→rediriger→agir aussitôt sur l'id)
// devient intermittent : tantôt un 404 après la redirection, tantôt un P2025 (produit
// introuvable) dans une action liée à cet id pourtant bien créé. Isolé (un seul worker),
// ou en série comme ici, chacun de ces trois tests passe systématiquement. Le mode série
// ne réintroduit pas le plafond global retiré par le Correctif 6 : les autres fichiers
// e2e (admin-auth.spec.ts) continuent de s'exécuter en parallèle normal.
test.describe.configure({ mode: 'serial' })

const prisma = new PrismaClient()
const SLUG_TEST = 'bracelet-soleil'
const SLUG_TEST_PARCOURS = 'collier-etoile-e2e'

// Dupliqué plutôt qu'importé de src/server/media.ts : même choix que
// tests/server/media.test.ts (fichierPour/LARGEURS_TEST), pour ne pas faire dépendre ce
// fichier e2e de la résolution de l'alias `@/*` par le test runner Playwright.
const LARGEURS = [400, 800, 1200] as const

async function effacerFichiersMediaTest(chemin: string) {
  const racinePublic = path.join(process.cwd(), 'public')
  const fichiers = LARGEURS.flatMap((largeur) =>
    (['avif', 'webp'] as const).map((extension) =>
      path.join(racinePublic, `${chemin}-${largeur}.${extension}`),
    ),
  )
  await Promise.all(fichiers.map((fichier) => rm(fichier, { force: true })))
}

// Supprime un produit de test avec tout ce qui en dépend : ses fichiers média sur disque
// (traiterImage() les écrit hors de la base, la cascade Prisma sur Media ne les efface
// pas), puis le produit lui-même (cascade Prisma sur Variant/Media), puis les lignes de
// journal d'audit qui le référencent — sans quoi elles resteraient orphelines après coup
// (Correctif 8 de la revue de la tâche 11 : « résidus d'audit »).
async function nettoyerProduitDeTest(slug: string) {
  const produit = await prisma.product.findUnique({
    where: { slug },
    include: { variants: true, media: true },
  })
  if (!produit) return

  await Promise.all(produit.media.map((media) => effacerFichiersMediaTest(media.chemin)))

  const entiteIds = [produit.id, ...produit.variants.map((v) => v.id), ...produit.media.map((m) => m.id)]
  await prisma.product.delete({ where: { id: produit.id } })
  await prisma.auditLog.deleteMany({ where: { entiteId: { in: entiteIds } } })
}

test.afterAll(async () => {
  // Nettoyage : sans cela, une seconde exécution échouerait sur la contrainte d'unicité du
  // slug plutôt que de re-vérifier le scénario.
  await nettoyerProduitDeTest(SLUG_TEST)
  await nettoyerProduitDeTest(SLUG_TEST_PARCOURS)
  await prisma.$disconnect()
})

test('création d\'un produit', async ({ page }) => {
  await page.goto('/admin/produits')
  await page.getByRole('link', { name: 'Nouveau produit' }).click()

  await page.getByLabel('Nom').fill('Bracelet Soleil')
  await page.getByLabel('Slug').fill(SLUG_TEST)
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
}) => {
  await page.goto('/admin/produits/nouveau')
  await page.getByLabel('Nom').fill('Collier Étoile')
  await page.getByLabel('Slug').fill(SLUG_TEST_PARCOURS)
  await page.getByLabel('Description').fill('Collier en argent massif, pendentif étoile.')
  await page.getByLabel('Prix', { exact: true }).fill('45000')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('heading', { name: 'Collier Étoile' })).toBeVisible()

  // Déclinaison : libellé, SKU, écart de prix (peut être négatif), stock.
  await page.getByLabel('Libellé').fill('Taille unique')
  await page.getByLabel('SKU').fill('COL-ETOILE-U')
  await page.getByLabel('Écart de prix').fill('-2000')
  await page.getByLabel('Stock').fill('7')
  await page.getByRole('button', { name: 'Ajouter la déclinaison' }).click()

  await expect(page.getByText('Taille unique')).toBeVisible()
  await expect(page.getByText('COL-ETOILE-U')).toBeVisible()
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
