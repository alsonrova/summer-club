import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

// Réutilise ADMIN_EMAIL / ADMIN_PASSWORD (le compte administrateur de seed), comme
// e2e/admin-auth.spec.ts. Le brief de cette tâche supposait un storageState pré-enregistré
// (e2e/.auth/admin.json) qui n'existe pas dans ce projet — aucune étape ne l'écrit encore —
// donc chaque test se connecte lui-même via l'écran de connexion, exactement comme
// admin-auth.spec.ts le fait déjà.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    'ADMIN_EMAIL / ADMIN_PASSWORD sont requis pour exécuter e2e/admin-produits.spec.ts ' +
      '(compte administrateur de seed). Définissez-les dans .env (voir .env.example) ' +
      'puis relancez `npx playwright test`.',
  )
}

const prisma = new PrismaClient()
const SLUG_TEST = 'bracelet-soleil'

async function seConnecter(page: Page) {
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail').fill(ADMIN_EMAIL!)
  await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL('/admin')
}

test.afterAll(async () => {
  // Nettoyage : sans cela, une seconde exécution échouerait sur la contrainte d'unicité du
  // slug plutôt que de re-vérifier le scénario.
  await prisma.product.deleteMany({ where: { slug: SLUG_TEST } })
  await prisma.$disconnect()
})

test('création d\'un produit', async ({ page }) => {
  await seConnecter(page)

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
  await seConnecter(page)

  await page.goto('/admin/produits/nouveau')
  await page.getByLabel('Prix', { exact: true }).fill('-100')
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(page.getByText('Le prix doit être positif')).toBeVisible()
})
