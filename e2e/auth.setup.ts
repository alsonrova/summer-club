import { test as setup, expect } from '@playwright/test'
import path from 'node:path'

// Correctif 6 (revue de la tâche 11) : chaque fichier e2e qui a besoin d'une session
// administrateur se connectait lui-même via l'écran de connexion, ouvrant six sessions au
// total sur une seule exécution de la suite — assez pour saturer le compartiment de
// limitation de débit partagé de /sign-in/email (voir src/server/auth.ts, `rateLimit`),
// ce qui avait forcé à plafonner Playwright à deux workers (palliatif, pas un correctif du
// rate limiter lui-même). Ce projet de préparation se connecte UNE seule fois et écrit
// l'état de session ici ; les specs qui n'ont pas explicitement besoin de rejouer le
// parcours de connexion (voir e2e/admin-produits.spec.ts) le rechargent via
// `test.use({ storageState: ... })` plutôt que de soumettre à nouveau le formulaire.
//
// e2e/admin-auth.spec.ts continue, lui, à se connecter via l'écran de connexion pour ses
// propres tests (« administrateur connecté… », « rôle membre ») : c'est précisément le
// parcours qu'il vérifie, storageState le court-circuiterait.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    'ADMIN_EMAIL / ADMIN_PASSWORD sont requis pour exécuter e2e/auth.setup.ts ' +
      '(compte administrateur de seed). Définissez-les dans .env (voir .env.example) ' +
      'puis relancez `npx playwright test`.',
  )
}

export const ADMIN_STATE_PATH = path.join(__dirname, '.auth', 'admin.json')

setup('connexion administrateur (une seule fois pour toute la suite)', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail').fill(ADMIN_EMAIL)
  await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL('/admin')

  await page.context().storageState({ path: ADMIN_STATE_PATH })
})
