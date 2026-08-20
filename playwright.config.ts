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
  webServer: {
    // Serveur de dev : plus simple qu'un build de production pour des tests locaux, et
    // Next.js y charge .env de la même façon.
    command: 'npm run dev',
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
