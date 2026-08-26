import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Plusieurs fichiers écrivent de vraies images dans public/uploads/ (via traiterImage)
    // puis vérifient, en fin de fichier, que ce dossier ne contient plus que .gitkeep
    // (tests/server/media.test.ts ; désormais aussi le chemin nominal de televerserMedia
    // dans tests/admin/produits-actions.test.ts, voir Correctif 7 de la revue de la tâche
    // 11). Contrairement à la base (chaque fichier isole ses propres lignes par un
    // préfixe distinct), ce dossier est une ressource globale non préfixable : exécuté en
    // parallèle (comportement par défaut de Vitest), un fichier peut observer le dossier
    // pendant qu'un autre y a encore des fichiers en cours de nettoyage, faisant échouer
    // l'assertion « uniquement .gitkeep » par une pure coïncidence de calendrier — constaté
    // en pratique (3 échecs sur 4 exécutions consécutives avant ce réglage). Les fichiers de
    // test s'exécutent donc en séquence, pas en parallèle : plus lent, mais élimine toute
    // cette classe de flakiness sur une ressource globale partagée.
    fileParallelism: false,
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
})
