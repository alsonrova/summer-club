import { test, expect, type TestInfo } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'

// Parcours public de la vitrine : catalogue → fiche produit (critères d'acceptation n°1
// et n°8 de la spec). Pas de `test.use({ storageState })` ici : le fixture `page` est une
// visiteuse anonyme, comme la cliente.
//
// Pourquoi le produit est créé par le back-office et non directement via Prisma, à
// l'inverse du reste de ce fichier (nettoyage) : /boutique est rendu statiquement au build
// et conservé cinq minutes (`revalidate = 300`, spec § 4.3). Une ligne insérée en base
// derrière le dos de l'application n'invalide rien — le catalogue continuerait de servir
// l'instantané du build, sans le produit, et le test rougirait à tort. Le seul chemin réel
// par lequel un produit apparaît en boutique est l'administration, dont les actions
// appellent revalidatePath('/boutique') (src/app/admin/produits/actions.ts). C'est donc ce
// chemin que le test emprunte, dans un contexte séparé qui recharge la session écrite une
// fois par e2e/auth.setup.ts. La fiche /boutique/[slug] d'un produit créé après le build
// n'est rendue qu'à sa première visite (generateStaticParams ne l'a pas listée) : elle
// voit la base telle qu'elle est à ce moment-là.

const prisma = new PrismaClient()
const ADMIN_STATE_PATH = path.join(__dirname, '.auth', 'admin.json')

// Slug propre à chaque test, dérivé de son titre — même raisonnement que
// e2e/admin-products.spec.ts (testSlug) : aucun partage de ligne entre tests ni entre
// répétitions (`--repeat-each`), et un nettoyage qui ne peut atteindre que sa propre ligne.
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
  return `e2e-storefront-${identity}${repeat}`
}

// Supprime le produit de test, ses déclinaisons (cascade Prisma) et les lignes d'audit
// que sa création par le back-office a écrites. Aucune photo n'est téléversée par ce
// fichier — la fiche exerce l'image de repli — donc rien à effacer sur disque. Tolère
// l'absence (deleteMany), pour que les passes d'avant et d'après puissent se croiser.
async function cleanUpTestProduct(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug }, include: { variants: true } })
  if (!product) return

  const entityIds = [product.id, ...product.variants.map((variant) => variant.id)]
  await prisma.product.deleteMany({ where: { id: product.id } })
  await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } })
}

test.beforeEach(async ({}, testInfo) => {
  await cleanUpTestProduct(testSlug(testInfo))
})

test.afterEach(async ({}, testInfo) => {
  await cleanUpTestProduct(testSlug(testInfo))
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
  // Ciblé par le href plutôt que par le nom : un autre test peut laisser un « Bracelet
  // Lagon » en catalogue, seul le slug est propre à celui-ci.
  await page.locator(`a[href="/boutique/${slug}"]`).click()

  // …et la fiche montre le titre, la déclinaison, le prix et ses données structurées.
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
