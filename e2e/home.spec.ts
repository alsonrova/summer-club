import { test, expect, type TestInfo } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'

// Page d'accueil (spec § 8, critère d'acceptation n° 6) : hero, histoire de la marque,
// sélection de produits, avis épinglés, bandeau final.
//
// Le parcours est celui d'une visiteuse anonyme — aucun `storageState` global ici, comme
// e2e/storefront.spec.ts. Le produit de la sélection est créé PAR LE BACK-OFFICE et non
// directement en base : l'accueil est rendu statiquement (`revalidate = 300`), et une
// ligne insérée derrière le dos de l'application n'invalide rien — la page continuerait de
// servir l'instantané du build. Le seul chemin réel par lequel un produit paraît en
// vitrine est l'administration, dont les actions invalident l'accueil, le catalogue et les
// fiches en suivant productPathsToRevalidate (src/server/products.ts). L'accueil y est
// entré à la tâche 15 : sans cette entrée, ce test rougit, et c'est ce qu'il prouve.
//
// Les avis, eux, sont écrits en base AVANT cette création : c'est elle qui invalide
// l'accueil, donc le rendu qui suit les voit tous les deux.

const prisma = new PrismaClient()
const ADMIN_STATE_PATH = path.join(__dirname, '.auth', 'admin.json')

// Jeton d'exécution, fixé une fois par processus de worker : le cache ISR persiste sous
// .next d'une exécution à l'autre sur le même serveur (`reuseExistingServer`), et le
// nettoyage par Prisma ne l'invalide pas — même raisonnement que e2e/storefront.spec.ts.
const RUN_TOKEN = Date.now().toString(36)

function testPrefix(testInfo: TestInfo): string {
  const identity = testInfo.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '')
  const repeat = testInfo.repeatEachIndex > 0 ? `-r${testInfo.repeatEachIndex}` : ''
  return `e2e-home-${identity}${repeat}`
}

function testSlug(testInfo: TestInfo): string {
  return `${testPrefix(testInfo)}-${RUN_TOKEN}`
}

// Supprime les lignes de CE fichier — celles de cette exécution et celles qu'une exécution
// précédente interrompue aurait laissées. Jamais de deleteMany sans filtre sur une table
// partagée (§ 6.3 des conventions). Aucune photo n'est téléversée ici : la carte exerce
// l'image de repli, donc rien à effacer sur disque.
async function cleanUp(prefix: string) {
  await prisma.review.deleteMany({ where: { author: { startsWith: prefix } } })
  const products = await prisma.product.findMany({
    where: { slug: { startsWith: prefix } },
    include: { variants: true },
  })
  for (const product of products) {
    const entityIds = [product.id, ...product.variants.map((variant) => variant.id)]
    await prisma.product.deleteMany({ where: { id: product.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } })
  }
}

test.beforeEach(async ({}, testInfo) => {
  await cleanUp(testPrefix(testInfo))
})

test.afterEach(async ({}, testInfo) => {
  await cleanUp(testPrefix(testInfo))
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test("la page d'accueil présente ses cinq sections à une visiteuse anonyme", async ({
  browser,
  page,
}, testInfo) => {
  const slug = testSlug(testInfo)
  const sku = slug.toUpperCase()
  const prefix = testPrefix(testInfo)

  // Un seul avis épinglé, et une assertion qui ne porte que sur lui : un autre fichier
  // peut épingler le sien en parallèle (e2e/admin-reviews.spec.ts), et la page n'en
  // affiche que trois. Avec un seul concurrent possible et `position` à 1, le mien reste
  // dans les trois premiers.
  await prisma.review.create({
    data: {
      author: `${prefix}-mialy`,
      rating: 5,
      body: 'Je le porte à la mer depuis trois mois, il est comme au premier jour.',
      source: 'verified',
      status: 'published',
      pinned: true,
      position: 1,
    },
  })

  // Création par le back-office, dans un contexte administrateur séparé. Le nom commence
  // par « A » à dessein : la sélection de l'accueil s'arrête aux huit premiers produits
  // (listProducts trie par ordre d'affichage puis par nom, tous à 0 par défaut), et les
  // produits que les autres fichiers e2e créent en parallèle portent des noms plus loin
  // dans l'alphabet. Sans cette précaution, la carte attendue pourrait tomber hors des
  // huit sans qu'aucune régression n'existe.
  const adminContext = await browser.newContext({ storageState: ADMIN_STATE_PATH })
  const adminPage = await adminContext.newPage()
  await adminPage.goto('/admin/produits/nouveau')
  await adminPage.getByLabel('Nom').fill('Anneau Alizé')
  await adminPage.getByLabel('Slug').fill(slug)
  await adminPage
    .getByLabel('Description')
    .fill('Anneau fin en acier inoxydable plaqué or 18k, porté seul ou empilé.')
  await adminPage.getByLabel('Prix', { exact: true }).fill('29000')
  await adminPage.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(adminPage.getByRole('heading', { name: 'Anneau Alizé' })).toBeVisible()

  await adminPage.getByLabel('Libellé').fill('Taille unique')
  await adminPage.getByLabel('SKU').fill(sku)
  await adminPage.getByLabel('Stock').fill('4')
  await adminPage.getByRole('button', { name: 'Ajouter la déclinaison' }).click()
  await expect(adminPage.getByText(sku)).toBeVisible()
  await adminContext.close()

  await page.goto('/')
  await expect(page).toHaveTitle(/Summer Club/)

  // 1. Hero — le seul h1 de la page, et l'appel à l'action.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // 2. About.
  await expect(page.getByRole('heading', { name: 'Notre histoire' })).toBeVisible()

  // 3. Sélection produits : la carte du produit créé à l'instant prouve que la création
  // a bien invalidé l'accueil.
  await expect(page.getByRole('heading', { name: 'Notre sélection' })).toBeVisible()
  const productLink = page.getByRole('link', { name: 'Anneau Alizé' })
  await expect(productLink).toBeVisible()
  await expect(page.getByText(/29\s*000\s*Ar/)).toBeVisible()

  // 4. Avis épinglés, badge compris.
  await expect(page.getByRole('heading', { name: 'Elles les portent' })).toBeVisible()
  await expect(page.getByText(/Je le porte à la mer/)).toBeVisible()
  await expect(page.getByText('Achat vérifié').first()).toBeVisible()

  // 5. Bandeau final.
  const banner = page.getByRole('region', { name: 'Rejoindre Summer Club' })
  await expect(banner.getByRole('link', { name: 'La boutique' })).toBeVisible()
  await expect(banner.getByRole('link', { name: 'Instagram' })).toBeVisible()

  // La carte mène bien à la fiche.
  await productLink.click()
  await expect(page).toHaveURL(`/boutique/${slug}`)
})

test("la page d'accueil ne porte qu'un seul h1", async ({ page }) => {
  // Un seul h1 par page (spec § 10, SEO technique) : le hero le porte, les autres
  // sections titrent en h2. Aucune donnée n'est nécessaire — la sélection et les avis
  // s'effacent quand ils sont vides, le hero reste.
  await page.goto('/')
  await expect(page.locator('h1')).toHaveCount(1)
})
