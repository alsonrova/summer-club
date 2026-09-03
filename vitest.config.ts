import { defineConfig } from 'vitest/config'

// `environmentMatchGlobs` a disparu de vitest 4 (vérifié dans node_modules/vitest —
// aucune occurrence de la chaîne dans le paquet installé, § 0 des conventions : la
// mémoire d'une version antérieure n'a pas voix ici). Le remplacement documenté par
// les types installés (`TestProjectInlineConfiguration` dans
// node_modules/vitest/dist/chunks/reporters.d.*.d.ts) est `test.projects` : chaque
// entrée `extends: true` hérite de la config racine (dont l'alias `@`) et ne redéfinit
// que l'environnement et le motif de fichiers qui lui sont propres. Les tests de base
// de données (`tests/**/*.test.ts`) restent en environnement `node`, sans changement ;
// les tests de composants (`tests/**/*.test.tsx`) passent en `jsdom`.
export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
          // Parallélisme des fichiers laissé au défaut (activé). `fileParallelism: false`
          // sérialisait les dix-sept fichiers de la suite pour arbitrer un conflit qui
          // n'opposait pas deux tests mais deux assertions trop larges : tests/server/media.test.ts
          // et tests/admin/produits-actions.test.ts vérifiaient tous deux que public/uploads/ ne
          // contient plus que .gitkeep — une assertion sur un état global, écrite dans des tests
          // qui ne possèdent pas ce dossier. Chacun sait pourtant exactement quels fichiers il a
          // produits : l'assertion porte désormais sur ses propres fichiers, et les deux peuvent
          // s'exécuter en parallèle sans se voir l'un l'autre.
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          include: ['tests/**/*.test.tsx'],
          environment: 'jsdom',
          // `@testing-library/react` n'enregistre son nettoyage automatique entre tests
          // (`afterEach(cleanup)`, node_modules/@testing-library/react/dist/index.js)
          // que s'il trouve un `afterEach` global au moment de son import — un test qui
          // l'importe explicitement depuis 'vitest' n'en fournit pas. Sans `globals`,
          // le DOM d'un `render()` survit au test suivant : deux images « Collier
          // Vahiné » coexistent alors et `getByAltText` échoue avec « plusieurs éléments
          // trouvés », symptôme observé en le vérifiant sans ce réglage.
          globals: true,
        },
      },
    ],
  },
})
