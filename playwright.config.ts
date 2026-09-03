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
  // Le plafond à 2 workers (voir l'historique git de cette ligne) soignait le symptôme,
  // pas la cause : chaque fichier e2e ayant besoin d'une session administrateur se
  // connectait lui-même via l'écran de connexion, saturant le compartiment de limitation
  // de débit partagé de /sign-in/email (voir src/server/auth.ts, `rateLimit` — un seul
  // compartiment pour tous les appelants tant que `advanced.ipAddress` n'est pas
  // configuré, prévu à la tâche 22). Le projet `setup` ci-dessous se connecte UNE seule
  // fois pour toute la suite (e2e/auth.setup.ts) ; les specs qui n'ont pas explicitement
  // besoin de rejouer le parcours de connexion réutilisent cet état via `storageState`
  // (voir e2e/admin-products.spec.ts) au lieu de soumettre le formulaire à nouveau.
  // Workers repassés au nombre de cœurs par défaut : la cause du plafond a disparu.
  webServer: {
    // Serveur de production : `next dev` ne repond pas sur cette machine (il demarre
    // sans jamais servir), et tester le build reellement deploye vaut mieux de toute
    // facon. Un `npm run build` doit donc preceder `playwright test`.
    //
    // Port dédié (3456) plutôt que le 3000 par défaut : plusieurs projets cohabitent sur
    // cette machine, et `reuseExistingServer` faisait tester N'IMPORTE QUEL serveur déjà
    // présent sur le port — constaté le 2026-09-03, la suite entière a échoué sur la page
    // d'accueil d'un autre projet qui écoutait sur 3000. BETTER_AUTH_URL doit suivre : Better
    // Auth le lit depuis l'environnement (auth.ts ne fixe pas de baseURL), et la valeur de
    // .env pointe sur 3000 ; sans cette surcharge, la vérification d'origine rejetterait
    // les soumissions du formulaire de connexion. Une variable déjà présente dans
    // l'environnement du process l'emporte sur .env — vérifié dans le code installé, pas
    // de mémoire : node_modules/@next/env/dist/index.js, processEnv(), n'applique une clé
    // de .env que si elle est absente de l'instantané initial de process.env.
    command: 'npm run start -- --port 3456',
    url: 'http://localhost:3456',
    env: { BETTER_AUTH_URL: 'http://localhost:3456' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:3456',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
})
