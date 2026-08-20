import { test, expect } from '@playwright/test'

// Réutilise directement ADMIN_EMAIL / ADMIN_PASSWORD (les variables consommées par
// `prisma/seed.ts` pour créer le compte administrateur) plutôt que d'introduire une
// variable E2E_ADMIN_PASSWORD séparée : c'est le même compte, pas besoin d'un second
// secret à tenir synchronisé. Voir .env.example.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

test('le back-office est inaccessible sans session', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/connexion/)
})

test('un administrateur connecté atteint le tableau de bord', async ({ page }) => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'ADMIN_EMAIL / ADMIN_PASSWORD absents : le compte admin de seed est requis pour ce test.',
  )

  await page.goto('/admin/connexion')
  await page.getByLabel('Adresse e-mail').fill(ADMIN_EMAIL!)
  await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL('/admin')
})
