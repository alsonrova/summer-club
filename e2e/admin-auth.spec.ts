import { test, expect } from '@playwright/test'
import { creerCompteMembre, supprimerCompte, fermerConnexionTest } from './utils/compte-membre'

// Réutilise directement ADMIN_EMAIL / ADMIN_PASSWORD (les variables consommées par
// `prisma/seed.ts` pour créer le compte administrateur) plutôt que d'introduire une
// variable E2E_ADMIN_PASSWORD séparée : c'est le même compte, pas besoin d'un second
// secret à tenir synchronisé. Voir .env.example.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

// L'absence de ces variables ne doit JAMAIS faire passer la suite au vert en silence :
// en intégration continue sans secrets, cela reviendrait à ne plus tester le parcours de
// connexion, sans que personne ne le remarque. On fait donc échouer explicitement au
// chargement du fichier plutôt que d'ignorer les tests concernés.
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    'ADMIN_EMAIL / ADMIN_PASSWORD sont requis pour exécuter e2e/admin-auth.spec.ts ' +
      '(compte administrateur de seed). Définissez-les dans .env (voir .env.example) ' +
      'puis relancez `npx playwright test`.',
  )
}

test.describe('accès anonyme', () => {
  test('le back-office est inaccessible sans session', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/connexion/)
  })

  test('une route d\'administration plausible mais inexistante est aussi protégée', async ({
    page,
  }) => {
    // Vérifie la protection "par construction" du Correctif 2 : ce test échouerait si
    // quelqu'un ajoutait un jour un écran sous /admin sans passer par le layout protégé.
    await page.goto('/admin/produits')
    await expect(page).toHaveURL(/\/connexion/)
  })
})

test('un administrateur connecté atteint le tableau de bord', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL('/admin')
})

test.describe('rôle membre', () => {
  const email = `membre-e2e-${Date.now()}@test.summerclub.mg`
  const motDePasse = 'motdepassetreslongpourletest'
  let userId: string | undefined

  test.afterAll(async () => {
    if (userId) await supprimerCompte(userId)
    await fermerConnexionTest()
  })

  test('un compte membre atteint /admin et obtient la page accès réservé, pas la connexion', async ({
    page,
  }) => {
    userId = await creerCompteMembre(email, motDePasse)

    await page.goto('/connexion')
    await page.getByLabel('Adresse e-mail').fill(email)
    await page.getByLabel('Mot de passe').fill(motDePasse)
    await page.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page).toHaveURL('/acces-refuse')
    await expect(page.getByRole('heading', { name: 'Accès réservé' })).toBeVisible()
  })
})
