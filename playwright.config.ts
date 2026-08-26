import { defineConfig, devices } from '@playwright/test'

// Charge .env (DATABASE_URL, BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD…) dans le
// process qui exécute les tests. `next dev`/`next start` (le webServer ci-dessous) charge
// déjà .env lui-même ; ce process-ci (le test runner) ne le fait pas nativement.
try {
  process.loadEnvFile('.env')
} catch {
  // Pas de .env (ex. CI) : les variables sont supposées déjà présentes dans l'environnement.
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  // Plafonné plutôt que laissé au nombre de cœurs (4 sur cette machine) : src/server/auth.ts
  // documente que la limitation de débit de Better Auth sur /sign-in/email retombe sur un
  // seul compartiment partagé par TOUS les appelants (`no-trusted-ip|...`) tant que
  // `advanced.ipAddress` n'est pas configuré (prévu à la tâche 22, avec le reverse proxy).
  // Constaté en pratique sur cette tâche : au-delà de 2 connexions admin réellement
  // simultanées, des tests par ailleurs corrects échouent par « Trop de tentatives », pas par
  // un vrai défaut de l'écran testé. Deux workers restent sous ce seuil ; à retirer une fois
  // la tâche 22 livrée.
  workers: 2,
  webServer: {
    // Serveur de production : `next dev` ne repond pas sur cette machine (il demarre
    // sans jamais servir), et tester le build reellement deploye vaut mieux de toute
    // facon. Un `npm run build` doit donc preceder `playwright test`.
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
