import { test, expect, type TestInfo } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'

// Parcours public de la vitrine : catalogue → fiche produit (critères d'acceptation n°1
// et n°8 de la spec). Pas de `test.use({ storageState })` ici : le fixture `page` est une
// visiteuse anonyme, comme la cliente.
//
// Pourquoi le produit est créé par le back-office et non directement via Prisma, à
// l'inverse du reste de ce fichier (nettoyage) : /boutique et /boutique/[slug] sont rendus
// statiquement et conservés cinq minutes (`revalidate = 300`, spec § 4.3). Une ligne
// insérée en base derrière le dos de l'application n'invalide rien — le catalogue
// continuerait de servir l'instantané du build, sans le produit, et le test rougirait à
// tort. Le seul chemin réel par lequel un produit apparaît en boutique est
// l'administration, dont les actions invalident catalogue ET fiches en suivant
// productPathsToRevalidate (src/server/products.ts). C'est donc ce chemin que le test
// emprunte, dans un contexte séparé qui recharge la session écrite une fois par
// e2e/auth.setup.ts. Le test visite la fiche AVANT de créer le produit : ce 404 entre dans
// le cache ISR, et c'est bien la création qui doit l'en chasser — c'est l'invalidation à la
// demande de la fiche qui est prouvée ici, pas seulement son rendu.
//
// Le slug porte un jeton propre à l'exécution (RUN_TOKEN) : le cache ISR persiste sous
// .next d'une exécution à l'autre sur le même serveur (reuseExistingServer), et le
// nettoyage par Prisma ne l'invalide pas — avec un slug stable, la seconde exécution aurait
// pu lire la fiche mise en cache par la première au lieu d'un rendu du produit qu'elle
// venait de créer. Le nettoyage, lui, balaie tout ce qui commence par l'identité du test,
// jetons d'exécutions précédentes compris.

const prisma = new PrismaClient()
const ADMIN_STATE_PATH = path.join(__dirname, '.auth', 'admin.json')

// Jeton d'exécution, fixé une fois par processus de worker : le même pour les hooks et le
// corps d'un même test, différent d'une exécution de la suite à l'autre.
const RUN_TOKEN = Date.now().toString(36)

// Préfixe de slug propre à chaque test, dérivé de son titre — même raisonnement que
// e2e/admin-products.spec.ts (testSlug) : aucun partage de ligne entre tests ni entre
// répétitions (`--repeat-each`), et un nettoyage qui ne peut atteindre que ses propres
// lignes.
function testSlugPrefix(testInfo: TestInfo): string {
  const identity = testInfo.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  const repeat = testInfo.repeatEachIndex > 0 ? `-r${testInfo.repeatEachIndex}` : ''
  return `e2e-storefront-${identity}${repeat}`
}

function testSlug(testInfo: TestInfo): string {
  return `${testSlugPrefix(testInfo)}-${RUN_TOKEN}`
}

// Supprime les produits de test portant ce préfixe — celui de cette exécution et ceux
// qu'une exécution précédente interrompue aurait laissés —, leurs déclinaisons (cascade
// Prisma) et les lignes d'audit que leur création par le back-office a écrites. Aucune
// photo n'est téléversée par ce fichier — la fiche exerce l'image de repli — donc rien à
// effacer sur disque. Tolère l'absence (deleteMany), pour que les passes d'avant et d'après
// puissent se croiser.
async function cleanUpTestProducts(slugPrefix: string) {
  const products = await prisma.product.findMany({
    where: { slug: { startsWith: slugPrefix } },
    include: { variants: true },
  })
  for (const product of products) {
    const entityIds = [product.id, ...product.variants.map((variant) => variant.id)]
    await prisma.product.deleteMany({ where: { id: product.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } })
  }
}

test.beforeEach(async ({}, testInfo) => {
  await cleanUpTestProducts(testSlugPrefix(testInfo))
})

test.afterEach(async ({}, testInfo) => {
  await cleanUpTestProducts(testSlugPrefix(testInfo))
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test("une visiteuse trouve en boutique un produit créé par l'administration et ouvre sa fiche", async ({
  browser,
  page,
}, testInfo) => {
  const slug = testSlug(testInfo)
  // SKU dérivé de l'identité du test : l'unicité de `sku` est globale (prisma/schema.prisma).
  const sku = slug.toUpperCase()

  // Avant toute création, la fiche est introuvable — et ce 404 entre dans le cache ISR
  // (mesuré : MISS puis HIT). Si la création ne l'invalidait pas, la visite finale lirait
  // ce 404 pendant cinq minutes.
  const before = await page.goto(`/boutique/${slug}`)
  expect(before?.status()).toBe(404)

  // Création par le back-office, dans un contexte administrateur séparé.
  const adminContext = await browser.newContext({ storageState: ADMIN_STATE_PATH })
  const adminPage = await adminContext.newPage()
  await adminPage.goto('/admin/produits/nouveau')
  await adminPage.getByLabel('Nom').fill('Bracelet Lagon')
  await adminPage.getByLabel('Slug').fill(slug)
  await adminPage
    .getByLabel('Description')
    .fill('Bracelet fin en acier inoxydable plaqué or 18k, fermoir mousqueton.')
  await adminPage.getByLabel('Prix', { exact: true }).fill('38000')
  await adminPage.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(adminPage.getByRole('heading', { name: 'Bracelet Lagon' })).toBeVisible()

  await adminPage.getByLabel('Libellé').fill('Taille unique')
  await adminPage.getByLabel('SKU').fill(sku)
  await adminPage.getByLabel('Stock').fill('3')
  await adminPage.getByRole('button', { name: 'Ajouter la déclinaison' }).click()
  await expect(adminPage.getByText(sku)).toBeVisible()
  await adminContext.close()

  // Visite anonyme : le catalogue liste le produit…
  await page.goto('/boutique')
  await expect(page.getByRole('heading', { level: 1, name: 'La boutique' })).toBeVisible()
  // Par son nom, comme la cliente le lit (le nom accessible du lien reprend le texte
  // alternatif de la photo puis le titre de la carte). Ce fichier est le seul à créer un
  // « Bracelet Lagon » et le nettoie avant comme après : un doublon en catalogue ferait
  // échouer le locator en mode strict — à dessein, plutôt que de cibler le href en CSS.
  const productLink = page.getByRole('link', { name: 'Bracelet Lagon' })
  await expect(productLink).toBeVisible()
  await productLink.click()

  // …et la fiche — celle dont le 404 était en cache — montre le titre, la déclinaison, le
  // prix et ses données structurées : la création l'a bien invalidée.
  await expect(page).toHaveURL(`/boutique/${slug}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Bracelet Lagon' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Taille unique' })).toBeChecked()
  // formatAriary sépare les groupes par une espace insécable : \s couvre les deux formes.
  await expect(page.getByText(/38\s*000\s*Ar/)).toBeVisible()

  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent()
  expect(jsonLd).toContain('"@type":"Product"')
  expect(JSON.parse(jsonLd ?? '')).toMatchObject({
    name: 'Bracelet Lagon',
    offers: { price: 38000, priceCurrency: 'MGA', availability: 'https://schema.org/InStock' },
  })
})

test('une fiche inconnue répond 404, en français, sans quitter la vitrine', async ({ page }) => {
  const response = await page.goto('/boutique/e2e-storefront-fiche-inconnue')
  expect(response?.status()).toBe(404)
  await expect(page.getByText("Cette pièce n'existe pas ou n'est plus en vente.")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Retour à la boutique' })).toBeVisible()
})

test('une adresse inconnue hors boutique répond 404, en français, sans quitter la vitrine', async ({
  page,
}) => {
  // Constat du testeur UX/UI (tâche 14) : hors de /boutique, toute adresse inconnue tombait
  // sur la 404 générique de Next.js — titre d'onglet et texte en anglais, sans en-tête ni
  // pied de page, sans lien de retour. src/app/not-found.tsx couvre désormais toute
  // adresse sans correspondance ; l'en-tête prouve que la cliente n'a pas quitté la vitrine.
  // Aucune route n'égale cette adresse : rien à créer ni à nettoyer, et pas de cache ISR.
  const response = await page.goto('/e2e-storefront-adresse-inconnue')
  expect(response?.status()).toBe(404)
  await expect(page).toHaveTitle(/Summer Club/)
  await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Retour à la boutique' })).toBeVisible()
})
