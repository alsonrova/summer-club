import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
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
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
})
