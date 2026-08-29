# Journal des agents — Summer Club

<!-- Fichier ENGENDRÉ par `npm run journal:render`. Ne pas le modifier à la
     main : la source de vérité est docs/journal/entries.jsonl. -->

Ce document recense ce que chaque agent d'intelligence artificielle a fait sur ce dépôt : ce qu'il a produit, ce qu'il a vérifié, ce qu'il a trouvé et ce qu'il laisse en suspens. Mode d'emploi : `docs/journal/README.md`.

**53 entrées** · 13 tâches · Développeur 31 · Auditeur qualité et sécurité 17 · Coordinateur 5

## Vue d'ensemble

| Date | Tâche | Rôle | Verdict | Commit |
| --- | --- | --- | --- | --- |
| 2026-08-12 | 1 | Développeur | livré | `6a06e44` |
| 2026-08-12 | 1 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-12 | 1 | Développeur | livré | `d1a89fa` |
| 2026-08-12 | 2 | Développeur | livré | `fdc5e64` |
| 2026-08-12 | 2 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-12 | 2 | Développeur | livré | `215617e` |
| 2026-08-12 | 3 | Développeur | livré | `55a65a9` |
| 2026-08-12 | 3 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-12 | 3 | Développeur | livré | `5b4291b` |
| 2026-08-13 | 4 | Développeur | livré | `ecfaa4e` |
| 2026-08-13 | 4 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-13 | 4 | Développeur | livré | `6ca1e97` |
| 2026-08-13 | 5 | Développeur | livré | `a585478` |
| 2026-08-13 | 5 | Auditeur qualité et sécurité | validé | — |
| 2026-08-13 | 6 | Développeur | livré | `e615756` |
| 2026-08-13 | 6 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-13 | 6 | Développeur | livré | `661cabe` |
| 2026-08-13 | 7 | Développeur | livré | `98aeb2a` |
| 2026-08-20 | 7 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-20 | 7 | Développeur | livré | `94dba59` |
| 2026-08-20 | 7 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-20 | 7 | Développeur | livré | `e9995e6` |
| 2026-08-20 | 7 | Coordinateur | consigné | — |
| 2026-08-20 | 8 | Développeur | livré | `c1453d7` |
| 2026-08-20 | 8 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-20 | 8 | Développeur | livré | `516e39e` |
| 2026-08-20 | 9 | Développeur | livré | `bf0d865` |
| 2026-08-20 | 9 | Développeur | livré | `5104b12` |
| 2026-08-20 | 9 | Coordinateur | consigné | `56cfd24` |
| 2026-08-26 | 9 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-26 | 9 | Développeur | livré | `831e4f7` |
| 2026-08-26 | 9 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-26 | 9 | Développeur | livré | `64fa3b6` |
| 2026-08-26 | 10 | Développeur | livré | `6c0f949` |
| 2026-08-26 | 10 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-26 | 10 | Développeur | livré | `c2d932a` |
| 2026-08-26 | 11 | Développeur | livré | `ad6c143` |
| 2026-08-27 | 11 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-27 | 11 | Développeur | livré | `6b8dc6f` |
| 2026-08-27 | 11 | Coordinateur | consigné | `5b65785` |
| 2026-08-27 | 11 | Développeur | livré | `747df26` |
| 2026-08-27 | 11 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-27 | 11 | Développeur | livré | `a358779` |
| 2026-08-28 | 11 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-28 | 11 | Développeur | livré | `ca6989c` |
| 2026-08-29 | 12 | Développeur | livré | `4551d6f` |
| 2026-08-29 | 12 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-29 | 12 | Développeur | livré | `d207d7c` |
| 2026-08-29 | 12 | Auditeur qualité et sécurité | correctifs demandés | — |
| 2026-08-29 | 12 | Développeur | livré | `bbaa4a9` |
| 2026-08-29 | 12 | Coordinateur | consigné | — |
| 2026-08-29 | conventions | Coordinateur | livré | — |
| 2026-08-29 | conventions | Développeur | livré | — |

## Tâche 1

### 2026-08-12 · Développeur — livré

Initialisation du projet Next.js 16 (App Router, src/, alias @/*) et pose des tokens de la charte « Peau et lin ». Polices Fraunces et Instrument Sans via next/font/google. TDD suivi : le test de contrastes a d'abord été vu rouge (5 verts, 1 rouge faute de tokens.css), puis vert. Deux écarts au brief, imposés par la version réellement installée : `typedRoutes` sorti de `experimental` (déprécié en 16.3.0) et `weight: 'variable'` pour Fraunces (next/font refuse des poids fixes avec des axes variables).

- **Commit** : `6a06e44`
- **Tests** : — → 6 Vitest (suite complète)
- **Fichiers** : `package.json`, `tsconfig.json`, `next.config.ts`, `src/styles/tokens.css`, `src/app/layout.tsx`, `src/app/globals.css`, `tests/tokens.test.ts`, `vitest.config.ts`
- **Réserve** : src/app/page.tsx reste la démonstration de create-next-app : ses classes ne correspondent plus aux tokens, remplacement attendu à la tâche 15.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-12 · Auditeur qualité et sécurité — correctifs demandés

Revue de la tâche 1. Un correctif demandé, deux points reportés.

- **Tests** : 6 Vitest → —
- **Important** : L'échelle typographique de la spec n'est déclarée nulle part dans les tokens de charte.
- **Mineur** : src/app/page.tsx (démo create-next-app) est visuellement cassée depuis la suppression de l'ancien @theme inline — à remplacer par la tâche 15.
- **Mineur** : Fraunces est chargée en fonte variable complète (contrainte des axes) : à réévaluer au budget de performance de la tâche 23.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-12 · Développeur — livré

Ajout des sept variables de l'échelle typographique de la spec dans le bloc @theme, plus un test de non-régression qui vérifie leur présence. Commit compagnon 454fef1 : alignement de cette échelle sur l'espace de noms --text-* de Tailwind v4.

- **Commit** : `d1a89fa`
- **Tests** : 6 Vitest → 7 Vitest (suite complète)
- **Fichiers** : `src/styles/tokens.css`, `tests/tokens.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 2

### 2026-08-12 · Développeur — livré

Schéma Prisma complet (13 tables, User ajouté) sur PostgreSQL 17 en conteneur (docker-db-1, port 5433), plus la contrainte CHECK variant_stock_non_negatif écrite à la main dans sa propre migration. TDD vérifié : la mise à jour à stock -1 réussissait avant la contrainte, échoue après. Cinq enums du brief étaient syntaxiquement invalides (valeurs sur une seule ligne), reformatés sans renommer une seule valeur. Prisma épinglé en 6.19.3 : la 7.x supprime `url = env()` dans le schéma.

- **Commit** : `fdc5e64`
- **Tests** : 7 Vitest → 8 Vitest (suite complète)
- **Fichiers** : `prisma/schema.prisma`, `prisma/migrations/20260812203606_init/migration.sql`, `prisma/migrations/20260812204141_stock_non_negatif/migration.sql`, `src/server/db.ts`, `tests/schema.test.ts`, `docker/compose.dev.yml`
- **Réserve** : npm install a échoué de façon non déterministe pendant toute la tâche (ENOTEMPTY/EPERM) ; plusieurs paquets ont dû être extraits à la main.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-12 · Auditeur qualité et sécurité — correctifs demandés

Revue du schéma. Un correctif demandé, plusieurs points reportés à des tâches ultérieures.

- **Important** : Index de clés étrangères manquants, et pas d'unicité sur (productId, libelle) des déclinaisons.
- **Mineur** : Pas d'unicité sur Media.isPrimary : deux photos peuvent se déclarer principales.
- **Mineur** : La zone de livraison n'est pas figée dans Order : son nom est perdu si la zone est supprimée.
- **Mineur** : Tables en PascalCase — attention au SQL brut de la tâche 7.
- **Réserve** : Product→Variant en Cascade et OrderItem→Variant en Restrict : supprimer un produit déjà commandé produira une erreur SQL brute. À traiter en tâche 11 par actif=false plutôt que par une suppression physique.
- **Réserve** : La table `expenses` de la spec §5 n'appartient à aucune tâche V1.0 — backlog V1.2.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-12 · Développeur — livré

Ajout des index de clés étrangères et de l'unicité (productId, libelle) sur les déclinaisons.

- **Commit** : `215617e`
- **Fichiers** : `prisma/schema.prisma`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 3

### 2026-08-12 · Développeur — livré

Arithmétique et formatage Ariary : formatAriary (groupes de milliers en espace insécable U+00A0, aucune décimale) et appliquerPourcentage (arrondi entier, plancher à zéro). Module pur, sans Prisma ni réseau ni horloge.

- **Commit** : `55a65a9`
- **Tests** : — → 8 Vitest sur tests/domain/money.test.ts
- **Fichiers** : `src/domain/money.ts`, `tests/domain/money.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-12 · Auditeur qualité et sécurité — correctifs demandés

Revue du formatage Ariary. Le constat s'est révélé être un faux positif : vérification faite avec `od -c`, les espaces sont bien des U+00A0. Le signalement a tout de même servi — les caractères invisibles induisent en erreur, la source les écrit désormais en séquences d'échappement.

- **Modèle** : haiku
- **Mineur** : Signale des espaces ordinaires là où le fichier contient bien U+00A0 — faux positif.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-12 · Développeur — livré

Réécriture des espaces insécables en séquences d'échappement, pour qu'une relecture ne dépende plus de caractères invisibles.

- **Commit** : `5b4291b`
- **Fichiers** : `src/domain/money.ts`, `tests/domain/money.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 4

### 2026-08-13 · Développeur — livré

Résolveur de prix : promotions par produit, catégorie ou globales, fenêtres de dates, masque de jours de semaine, happy hour, réservé aux membres, priorité puis prix le plus bas. Aucun cumul. Module pur : `maintenant` est reçu en paramètre, jamais lu depuis l'horloge.

- **Commit** : `ecfaa4e`
- **Tests** : — → 32 Vitest (suite complète)
- **Fichiers** : `src/domain/pricing.ts`, `src/domain/types.ts`, `tests/domain/pricing.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-13 · Auditeur qualité et sécurité — correctifs demandés

Revue du résolveur de prix : un constat critique et deux importants, tous confirmés.

- **Critique** : Une happy hour qui franchit minuit (22h → 2h) n'est couverte par aucun test.
- **Important** : Le jour de la semaine est déduit d'une abréviation localisée : si l'indexOf échoue (données ICU réduites, autre version de Node), `masque >> -1` vaut `masque >> 31` = 0 et TOUTES les promotions sont désactivées en silence.
- **Important** : Une plage horaire à moitié renseignée laisse la promotion s'appliquer 24 h/24 — une remise permanente par erreur coûte de l'argent.
- **Mineur** : `?? 0` sur les composantes de date reste un repli silencieux.
- **Mineur** : Asymétrie d'inclusivité entre les dates [début, fin] et les heures [début, fin[ — attention à la construction de `fin` dans le back-office promotions (V1.1).
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-13 · Développeur — livré

Jour et heure calculés numériquement (année/mois/jour locaux reconstruits en UTC puis getUTCDay), plage horaire à moitié renseignée traitée en fail-closed, sept tests ajoutés dont la happy hour franchissant minuit.

- **Commit** : `6ca1e97`
- **Tests** : — → 23 Vitest sur tests/domain/pricing.test.ts (16 d'origine + 7)
- **Fichiers** : `src/domain/pricing.ts`, `tests/domain/pricing.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 5

### 2026-08-13 · Développeur — livré

Totaux du panier et frais de livraison : sous-total par réduction, zone non choisie traitée comme zéro sans faire échouer le calcul, panier vide ne facture jamais de livraison, tous les montants restent entiers.

- **Commit** : `a585478`
- **Tests** : — → 6 Vitest sur tests/domain/cart.test.ts
- **Fichiers** : `src/domain/cart.ts`, `tests/domain/cart.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-13 · Auditeur qualité et sécurité — validé

Revue des totaux du panier : aucun constat, rien à corriger.

- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 6

### 2026-08-13 · Développeur — livré

Machine à états des commandes : neuf statuts, table de transitions, ensemble STOCK_ENGAGE et effetSurStock. Module pur.

- **Commit** : `e615756`
- **Tests** : — → 11 Vitest sur tests/domain/order-status.test.ts
- **Fichiers** : `src/domain/order-status.ts`, `tests/domain/order-status.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-13 · Auditeur qualité et sécurité — correctifs demandés

Revue de la machine à états : effetSurStock et transitionAutorisee raisonnaient indépendamment.

- **Important** : effetSurStock renvoyait un effet sur 34 des 40 paires pourtant interdites par transitionAutorisee : effetSurStock('annulee','confirmee') = 'decrementer' (survente d'une commande annulée), effetSurStock('livree','annulee') = 'recrediter' (stock fantôme).
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-13 · Développeur — livré

effetSurStock consulte transitionAutorisee en première ligne et renvoie 'aucun' pour une transition interdite : entre décrémenter à tort et ne rien faire, ne rien faire est le seul des deux qui ne fausse pas l'inventaire. Test d'invariant sur les 81 couples ajouté.

- **Commit** : `661cabe`
- **Tests** : — → 16 Vitest sur tests/domain/order-status.test.ts
- **Fichiers** : `src/domain/order-status.ts`, `tests/domain/order-status.test.ts`
- **Réserve** : effetSurStock reste pure et sans mémoire : la protection anti-rejeu (webhook livré deux fois, double clic) appartient à l'appelant, qui doit relire l'état réel en base et faire lecture, décision et écriture dans une même transaction. Avertissement destiné aux tâches 7, 12 et 19.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 7

### 2026-08-13 · Développeur — livré

Création transactionnelle des commandes : décrément du stock et écriture de la commande dans une seule transaction, sans survente possible.

- **Commit** : `98aeb2a`
- **Tests** : — → 66 Vitest (suite complète)
- **Fichiers** : `src/server/orders.ts`, `tests/server/orders.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-20 · Auditeur qualité et sécurité — correctifs demandés

Première vague de revue sur la création de commande : trois constats critiques, tous reproduits.

- **Critique** : Une quantité négative créait du stock — total de -220 000 Ar observé sur une commande réelle.
- **Critique** : isolationLevel 'Serializable' combiné à SELECT … FOR UPDATE : une transaction bloquée sur le verrou n'obtient jamais celui-ci et PostgreSQL l'avorte en 40001. Mesuré : une vente sur deux rejetée à tort.
- **Critique** : La même déclinaison présente deux fois dans le panier échappait au contrôle de stock.
- **Important** : Produits et zones désactivés restaient commandables ; erreurs non typées.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-20 · Développeur — livré

Validation des entrées, passage en Read Committed avec FOR UPDATE (vérifié à 30 transactions simultanées), agrégation des quantités par déclinaison, produits et zones désactivés refusés, erreurs typées. Réservation du stock dès la création pour le canal orange_money. Commit compagnon 22f31b0 (plan) et 24520a3 (retrait d'un rapport de travail du suivi git).

- **Commit** : `94dba59`
- **Fichiers** : `src/server/orders.ts`, `src/domain/order-status.ts`, `tests/server/orders.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-20 · Auditeur qualité et sécurité — correctifs demandés

Seconde vague : le correctif d'agrégation laissait un contournement, et les tests pouvaient empoisonner la base.

- **Important** : Le plafond de 20 unités par déclinaison reste contournable en répétant la même déclinaison sur plusieurs lignes du panier.
- **Important** : Les tests pouvaient laisser des lignes derrière eux et empoisonner les suivants — nettoyage à faire en beforeEach.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-20 · Développeur — livré

Plafond appliqué à la quantité AGRÉGÉE par déclinaison, et beforeEach de nettoyage dans les tests. Commit compagnon b7c519c : correction du plan sur l'isolation transactionnelle des tâches 7 et 12.

- **Commit** : `e9995e6`
- **Tests** : — → 83 Vitest (suite complète)
- **Fichiers** : `src/server/orders.ts`, `tests/server/orders.test.ts`
- **Réserve** : promotionId et prixInitial ne sont pas conservés sur OrderItem : impossible de savoir a posteriori quelle promotion a servi. Backlog V1.1.
- **Réserve** : Le beforeEach fait order.deleteMany() sans filtre.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-20 · Coordinateur — consigné

Arbitrage demandé à la propriétaire sur trois points que le code ne pouvait pas trancher seul. Décisions retenues : orange_money réserve le stock dès la création de la commande (l'argent est en vol) ; whatsapp ne réserve rien mais sa confirmation contrôle le stock ; expediee → annulee recrédite le stock immédiatement, choix assumé pour une boutique qui livre elle-même. D'où la présence de en_attente_paiement dans STOCK_ENGAGE.

- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 8

### 2026-08-20 · Développeur — livré

Pipeline de traitement des images produit : recadrage 4:5, trois largeurs, sorties AVIF et WebP via sharp. Commit compagnon b357e7d (déclaration de sharp).

- **Commit** : `c1453d7`
- **Tests** : — → 85 Vitest (suite complète)
- **Fichiers** : `src/server/media.ts`, `tests/server/media.test.ts`, `package.json`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-20 · Auditeur qualité et sécurité — correctifs demandés

Revue du pipeline d'images : quatre constats importants, dont une traversée de chemin confirmée.

- **Important** : nomBase n'est pas assaini : traversée de chemin confirmée (path.join normalise les .. mais ne les borne pas).
- **Important** : Deux téléversements concurrents peuvent produire le même nom de fichier et s'écraser.
- **Important** : normalise() étire l'histogramme image par image : cela rend le catalogue HÉTÉROGÈNE, l'inverse du but recherché.
- **Important** : Couverture insuffisante : le ratio n'est pas vérifié sur les trois largeurs et les deux formats, l'orientation EXIF n'est pas réellement exercée, l'absence de résidus n'est pas assérée.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-20 · Développeur — livré

nomBase assaini dans traiterImage, suffixe aléatoire généré par traiterImage elle-même (plus par l'appelant) contre les collisions, normalise() retiré, couverture complétée. Commit compagnon b0e8a8f (plan).

- **Commit** : `516e39e`
- **Tests** : — → 90 Vitest (suite complète)
- **Fichiers** : `src/server/media.ts`, `tests/server/media.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 9

### 2026-08-20 · Développeur — livré

Authentification administrateur (Better Auth 1.7.x, adaptateur Prisma, plugin admin) et protection du back-office. Le modèle User a été aligné sur ce qu'attend Better Auth en lisant ses sources installées plutôt que la mémoire du modèle ; `nom` et `tel` conservés via user.fields.

- **Commit** : `bf0d865`
- **Tests** : 90 Vitest → 90 Vitest ; Playwright non exécutable à ce commit (le webServer visait `next dev`, qui ne sert rien sur cette machine)
- **Fichiers** : `src/server/auth.ts`, `prisma/schema.prisma`, `src/app/admin/layout.tsx`, `src/app/api/auth/[...all]/route.ts`, `playwright.config.ts`, `e2e/admin-auth.spec.ts`
- **Critique** : Trouvé par vérification manuelle, pas par la revue : /admin/connexion vivait sous le layout appelant requireAdmin() — boucle de redirection infinie, back-office totalement inaccessible.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-20 · Développeur — livré

Page de connexion sortie du layout protégé (fin de la boucle de redirection) et configuration Playwright pointée sur le build de production.

- **Commit** : `5104b12`
- **Tests** : — → 90 Vitest / 4 Playwright
- **Fichiers** : `src/app/connexion/page.tsx`, `src/app/admin/layout.tsx`, `playwright.config.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-20 · Coordinateur — consigné

Passation écrite après les tâches 1 à 9 : état, pièges d'environnement, décisions de la propriétaire, dettes ouvertes.

- **Commit** : `56cfd24`
- **Fichiers** : `docs/passation/2026-08-13-v1.0-taches-1-a-9.md`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-26 · Auditeur qualité et sécurité — correctifs demandés

Revue de l'authentification : deux constats bloquants, trois importants.

- **Critique** : L'inscription publique est ouverte : POST /api/auth/sign-up/email est joignable sans session. L'escalade de rôle est impossible (role en input:false), mais c'est un chemin d'écriture anonyme vers la base.
- **Critique** : La protection n'est pas acquise par défaut : le groupe de routes (protege) est invisible dans l'URL, donc une page posée sous admin/stock/ aurait été publique sans le moindre symptôme.
- **Important** : 401 et 403 confondus : un membre déjà connecté était renvoyé vers le formulaire de connexion, d'où un va-et-vient sans fin.
- **Important** : .env.example proposait un secret de 43 caractères qui passait tous les contrôles : déploiement possible avec la clé de signature publiée dans le dépôt.
- **Important** : Un 429 de limitation de débit s'affichait comme « mot de passe incorrect ».
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-26 · Développeur — livré

disableSignUp: true, connexion sortie vers /connexion avec requireAdmin() remis sur admin/layout.tsx ET sur chaque page, src/proxy.ts ajouté (garde optimiste sur le cookie seul), distinction 401/403, garde au démarrage sur le secret, message de 429 explicite.

- **Commit** : `831e4f7`
- **Fichiers** : `src/server/auth.ts`, `src/proxy.ts`, `src/app/connexion/page.tsx`, `.env.example`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-26 · Auditeur qualité et sécurité — correctifs demandés

Seconde vague : le correctif précédent avait introduit une régression, et la convention d'administration ne couvrait pas tous les points d'entrée.

- **Important** : customRules à 900 s suppose un compteur par IP. Sans advanced.ipAddress configuré, le seau est global (clé no-trusted-ip) : n'importe qui verrouillait la connexion de l'administratrice pendant quinze minutes. Régression introduite par le correctif précédent.
- **Important** : Les Route Handlers étaient absents de la convention requireAdmin() : un fichier admin/**/route.ts n'exécute jamais de layout.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-26 · Développeur — livré

Fenêtre de limitation de débit ramenée à 60 s avec le commentaire expliquant pourquoi elle ne doit pas être allongée avant advanced.ipAddress, et convention étendue explicitement aux Route Handlers. Commit compagnon dc43996 : alignement du plan sur l'architecture d'authentification réellement livrée.

- **Commit** : `64fa3b6`
- **Tests** : — → 90 Vitest / 4 Playwright
- **Fichiers** : `src/server/auth.ts`, `src/proxy.ts`
- **Réserve** : advanced.ipAddress reste non configuré : la fenêtre de 60 s est un palliatif borné, à revisiter à la tâche 22 derrière Caddy.
- **Réserve** : La branche « cookie présent mais invalide » n'est pas couverte en bout en bout ; /admin/connexion renvoie 404 pour les marque-pages.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 10

### 2026-08-26 · Développeur — livré

Moteur d'administration piloté par schéma : defineResource dérive champs de formulaire, colonnes et filtres d'un schéma Zod ; AdminTable et AdminForm en sont les vues ; versCSV exporte avec échappement anti-injection de formule ; enregistrerAudit trace les écritures. Piège du brief évité en inspectant zod 4.4.3 avec `node -e` : le code fourni lisait _def.typeName (API zod 3), qui vaut undefined en zod 4 et aurait classé TOUS les champs en texte, silencieusement. Commit compagnon c08dc50 (zod en dépendance directe).

- **Commit** : `6c0f949`
- **Tests** : — → 97 Vitest (suite complète)
- **Fichiers** : `src/admin/resource.ts`, `src/admin/engine/csv.ts`, `src/admin/engine/actions.ts`, `src/admin/engine/table.tsx`, `src/admin/engine/form.tsx`, `src/server/audit.ts`, `tests/admin/csv.test.ts`, `tests/admin/resource.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-26 · Auditeur qualité et sécurité — correctifs demandés

Revue du moteur d'administration : trois constats importants, dont un chemin d'écriture non borné vers Prisma.

- **Important** : Les champs système (id, createdAt, updatedAt) sont exposés au formulaire et écrits tels quels vers Prisma : un id ou une date forgés dans le formulaire soumis seraient acceptés.
- **Important** : Les messages de validation zod s'affichent en anglais dans une interface française.
- **Important** : versCSV préfixait -5000 (montant légitime) comme une formule : les nombres bien formés ne doivent pas l'être, contrairement à -1+1 ou --5000.
- **Mineur** : `as never` non commenté dans src/server/audit.ts.
- **Mineur** : aria-invalid et aria-describedby absents des champs en erreur.
- **Mineur** : Libellés de formulaire ni capitalisés ni surchargeables.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-26 · Développeur — livré

Champs système exclus par défaut du formulaire et retirés avant l'écriture Prisma (surchargeable), z.config(z.locales.fr()) posé dans resource.ts (les messages explicites des schémas restent prioritaires, vérifié), échappement CSV corrigé, aria-invalid/aria-describedby et libellés surchargeables ajoutés.

- **Commit** : `c2d932a`
- **Tests** : — → 108 Vitest (suite complète)
- **Fichiers** : `src/admin/resource.ts`, `src/admin/engine/actions.ts`, `src/admin/engine/csv.ts`, `src/admin/engine/form.tsx`, `src/server/audit.ts`, `tests/admin/champs-systeme.test.ts`, `tests/admin/csv-nombres.test.ts`, `tests/admin/locale.test.ts`
- **Réserve** : La vraie requête paginée (skip/take + comptage) reste à écrire : AdminTable n'est qu'un composant de présentation. À la tâche 11.
- **Réserve** : champs-systeme.test.ts est le premier test du projet à utiliser vi.mock, là où tous les autres tapent une vraie base — motif à harmoniser s'il se généralise.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 11

### 2026-08-26 · Développeur — livré

Écrans d'administration des produits, du stock et des médias : liste paginée réelle (skip/take/count côté Prisma), fiche produit, déclinaisons, ajustement de stock, galerie photos et téléversement. Toutes les Server Actions appellent requireAdmin() elles-mêmes.

- **Commit** : `ad6c143`
- **Tests** : 108 Vitest / 4 Playwright → 130 Vitest / 6 Playwright
- **Fichiers** : `src/admin/resources/products.ts`, `src/app/admin/produits/query.ts`, `src/app/admin/produits/actions.ts`, `src/app/admin/produits/page.tsx`, `src/app/admin/produits/[id]/page.tsx`, `e2e/admin-produits.spec.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-27 · Auditeur qualité et sécurité — correctifs demandés

Revue de la tâche 11 (un implémenteur, trois relectures adverses, une synthèse). Le code de production est jugé correct ; quatre correctifs demandés sur le diagnostic et l'outillage de test. ATTENTION : le diagnostic proposé par cette revue pour l'intermittence des tests de bout en bout — concurrence des Server Actions, lien avec output: 'standalone' — s'est révélé FAUX et a été propagé dans trois documents avant d'être purgé.

- **Important** : Suite de bout en bout intermittente : des tests suppriment les données des autres.
- **Réserve** : Le diagnostic de cause avancé par cette revue était erroné. Voir les entrées suivantes.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-27 · Développeur — livré

Déclinaisons, pagination stable, gestion des photos, et première passe de fiabilisation de la suite de bout en bout.

- **Commit** : `6b8dc6f`
- **Tests** : — → 151 Vitest / 8 Playwright
- **Fichiers** : `src/app/admin/produits/[id]/page.tsx`, `src/app/admin/produits/query.ts`, `e2e/admin-produits.spec.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-27 · Coordinateur — consigné

Passation écrite après les tâches 1 à 11.

- **Commit** : `5b65785`
- **Fichiers** : `docs/passation/2026-08-27-v1.0-taches-1-a-11.md`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-27 · Développeur — livré

VRAIE cause de l'intermittence trouvée : test.afterAll s'exécute UNE FOIS PAR WORKER et supprimait les produits des autres tests. Corrigée par un slug et un SKU dérivés de l'identité de chaque test, avec nettoyage par test. Les deux contournements — mode: 'serial' côté Playwright et fileParallelism: false côté Vitest — ont été RETIRÉS : la suite passe de 25 s à environ 9 s.

- **Commit** : `747df26`
- **Fichiers** : `e2e/admin-produits.spec.ts`, `vitest.config.ts`, `playwright.config.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-27 · Auditeur qualité et sécurité — correctifs demandés

Passe bloquante sur la documentation : les documents mentaient sur le code.

- **Important** : La fausse cause de l'intermittence subsiste à trois endroits, dont la passation versionnée — laquelle affirme en outre que ses propres correctifs ne sont pas appliqués.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-27 · Développeur — livré

Purge de la fausse cause dans la documentation, et test de la branche non couverte du message d'image illisible.

- **Commit** : `a358779`
- **Fichiers** : `docs/passation/2026-08-27-v1.0-taches-1-a-11.md`, `tests/server/media-validation.test.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-28 · Auditeur qualité et sécurité — correctifs demandés

Passe finale : trois points de forme, dont un document qui ne peut pas dire vrai par construction.

- **Important** : La validation `.trim()` sur le nom n'a aucun filet de test alors qu'elle conditionne le texte alternatif par défaut d'une photo.
- **Mineur** : La passation cite sa propre SHA : un document versionné AVEC le changement qu'il décrit ne peut pas citer le commit qui le contient.
- **Mineur** : Trois mockRestore() en instruction terminale : si une assertion échoue avant, l'espion fuit vers les tests suivants du fichier.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-28 · Développeur — livré

SHA auto-référentielle retirée de la passation, filet de test ajouté sur .trim(), mockRestore terminaux remplacés par un afterEach au niveau du module. Commit compagnon 6cf1582 : rectification d'une affirmation fausse sur la branche wip — la suite y passait (152/152), le conteneur PostgreSQL était simplement arrêté au moment de la mesure.

- **Commit** : `ca6989c`
- **Tests** : — → 155 Vitest / 8 Playwright
- **Fichiers** : `docs/passation/2026-08-27-v1.0-taches-1-a-11.md`, `src/admin/resources/products.ts`, `tests/admin/produits-actions.test.ts`, `tests/admin/produits-query.test.ts`
- **Réserve** : Backlog non bloquant : alt par rang de photo, slug de test injectif, cohérence des <Link> de la pagination et sa couverture de bout en bout, transaction ou index unique partiel sur Media.isPrimary.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche 12

### 2026-08-29 · Développeur — livré

Écrans d'administration des commandes et des avis. appliquerStatut (cœur métier, SANS requireAdmin) isolé dans src/server/order-status-service.ts pour que le webhook de paiement de la tâche 19 puisse l'appeler ; changerStatut en est l'enveloppe authentifiée. Read Committed avec FOR UPDATE, jamais Serializable ; verrou aussi sur la ligne Order, sans lequel deux annulations concurrentes recréditaient deux fois ; décision prise sur l'état RELU dans la transaction. enregistrerAudit accepte désormais un client de transaction : écrite hors transaction, la trace survivait à un ROLLBACK. Trois écarts au brief documentés, dont revalidatePath sorti du cœur (le code du brief rendait ses propres tests impossibles à passer) et une fixture qui entrait en collision avec tests/server/orders.test.ts — corrigée en donnant à chaque fichier ses propres lignes, sans aucune sérialisation, plafond de workers, retry ni délai.

- **Commit** : `4551d6f`
- **Tests** : 155 Vitest / 8 Playwright → 185 Vitest / 13 Playwright
- **Fichiers** : `src/server/order-status-service.ts`, `src/server/reviews.ts`, `src/server/audit.ts`, `src/domain/order-status.ts`, `src/app/admin/commandes/actions.ts`, `src/app/admin/avis/actions.ts`, `tests/server/statut.test.ts`, `e2e/admin-commandes.spec.ts`, `e2e/admin-avis.spec.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-29 · Auditeur qualité et sécurité — correctifs demandés

Trois relectures adverses de la tâche 12. Deux invariants posés au mauvais endroit, et trois affirmations du rapport prises en flagrant délit de fausseté.

- **Important** : L'invariant « pas d'épinglage d'un avis non publié » ne vit que dans le composant client. Une Server Action est un point d'entrée POST : le scénario des deux onglets est reproductible.
- **Important** : Des valeurs forgées atteignent la base sans garde de type sur les Server Actions d'avis et de statut.
- **Important** : Trois affirmations fausses dans le rapport : une couverture annoncée qui n'existe pas, un test censé couvrir l'audit transactionnel mais qui s'arrête avant de l'atteindre, et une base « laissée propre » que le paragraphe de réserves du même document contredit.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-29 · Développeur — livré

Invariant d'épinglage appliqué côté serveur, validation des statuts posée avant l'énumération PostgreSQL, et rectification des trois affirmations fausses du rapport de la tâche 12.

- **Commit** : `d207d7c`
- **Fichiers** : `src/app/admin/avis/actions.ts`, `src/app/admin/commandes/actions.ts`, `src/server/reviews.ts`
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-29 · Auditeur qualité et sécurité — correctifs demandés

Seconde passe. Motif à surveiller : la passe précédente a fermé `statut` et laissé `epingle` ouvert, dans le MÊME fichier — chaque passe corrige un cas et laisse son symétrique ouvert.

- **Important** : Le garde de type manque encore sur `epingle`, symétrique de celui posé sur `statut` au commit précédent.
- **Mineur** : Les décisions sur un avis ne sont pas idempotentes.
- **Mineur** : listerAvisPagines n'a aucune couverture.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-29 · Développeur — livré

Garde de type posé sur l'épinglage, décisions d'avis rendues idempotentes, couverture de listerAvisPagines comblée. Preuve par mutation faite sur le chemin sensible : le contrôle de stock de la confirmation retiré, le test « lève RuptureStockError quand le stock est parti entre-temps » rougit seul, sur PrismaClientUnknownRequestError — c'est-à-dire la contrainte CHECK de la base à la place du contrôle métier. Restauré : 13/13.

- **Commit** : `bbaa4a9`
- **Tests** : — → 222 Vitest / 13 Playwright
- **Fichiers** : `src/app/admin/avis/actions.ts`, `src/app/admin/avis/query.ts`, `tests/admin/avis-actions.test.ts`, `tests/admin/avis-query.test.ts`
- **Réserve** : Gardes d'idempotence lus hors transaction (écran mono-utilisatrice).
- **Réserve** : Intermittence de bout en bout vue UNE fois (bouton bloqué sur « Enregistrement… » 30 s), non reproduite en quatre exécutions.
- **Réserve** : `id` et `orderId` volontairement non validés — décision documentée.
- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

### 2026-08-29 · Coordinateur — consigné

Erreur d'orchestration reconnue et corrigée en règle. Trois vérificateurs avaient été lancés en parallèle sur le MÊME arbre de travail, l'un d'eux autorisé à muter le code pour une preuve par mutation. Un autre a vu disparaître le garde-fou de stock sous ses yeux et a conclu à un défaut critique inexistant. Règle adoptée : les agents de vérification travaillent en LECTURE STRICTE, et une vérification par mutation se fait seule et séquentiellement.

- _Entrée reconstituée a posteriori — horodatage calé sur un commit._

## Tâche conventions

### 2026-08-29 · Coordinateur — livré

Les cinq règles fixées par le propriétaire sont inscrites dans docs/CONVENTIONS.md, document qui fait désormais autorité : projet indépendant, identifiants en anglais et tout ce que lit un humain en français, architecture en quatre couches avec règle de dépendance, SOLID illustré par du code réel de ce dépôt, quatre rôles d'agents avec leurs livrables, et la règle d'orchestration « vérificateurs en lecture stricte ». Les règles éparses des revues successives, qui ne vivaient que dans .superpowers/sdd/progress.md (non versionné), y sont consignées. CLAUDE.md pointe dessus ; la passation 2026-08-29 remplace celle du 27 ; la spec et le plan portent un avertissement disant que leurs identifiants français précèdent la règle. AUCUN renommage effectué : c'est un travail séparé.

- **Modèle** : claude-opus-5
- **Tests** : 222 Vitest / 13 Playwright → 240 Vitest / 13 Playwright
- **Fichiers** : `docs/CONVENTIONS.md`, `CLAUDE.md`, `docs/passation/2026-08-29-v1.0-taches-1-a-12.md`, `docs/passation/2026-08-27-v1.0-taches-1-a-11.md`, `docs/superpowers/specs/2026-08-12-summerclub-boutique-design.md`, `docs/superpowers/plans/2026-08-12-summerclub-v1.0.md`
- **Réserve** : L'exemple SOLID le plus net de ce projet, l'interface PaymentProvider, n'existe que dans le plan (tâche 17) : le document le dit explicitement plutôt que de le présenter comme livré.
- **Réserve** : Champ commit laissé vide : cette entrée est versionnée DANS le commit qu'elle décrirait — c'est la leçon de la SHA auto-référentielle de la tâche 11.

### 2026-08-29 · Développeur — livré

Outil de journal des agents construit dans tools/agent-journal/, hors de src/ : trois modules .mjs sans aucune dépendance nouvelle (journal.mjs le cœur pur, store.mjs le seul accès disque, cli.mjs l'interface). Stockage versionné et append-only en JSON lines sous docs/journal/. Commandes add, list (filtrable par tâche et par rôle), render et help ; scripts npm journal, journal:add, journal:list, journal:render. Deux garde-fous : une ligne illisible fait échouer la lecture en citant son numéro plutôt que de disparaître en silence, et add refuse d'écrire derrière un fichier sans saut de ligne final. Journal amorcé avec 51 entrées reconstituées de l'histoire réelle des douze tâches livrées ; aucun chiffre inventé, champ model laissé vide là où il n'a jamais été consigné.

- **Modèle** : claude-opus-5
- **Tests** : 222 Vitest / 13 Playwright → 240 Vitest / 13 Playwright
- **Fichiers** : `tools/agent-journal/journal.mjs`, `tools/agent-journal/store.mjs`, `tools/agent-journal/cli.mjs`, `tests/tools/agent-journal.test.ts`, `docs/journal/entries.jsonl`, `docs/journal/README.md`, `docs/journal/JOURNAL.md`, `package.json`
- **Important** : Vérifié plutôt que supposé : tsc --noEmit --listFiles ne liste aucun fichier de tools/ — les .mjs ne sont couverts par aucun motif include du tsconfig. Le build de production produit les mêmes onze routes qu'avant.
- **Réserve** : Preuve par mutation faite seule et séquentiellement : parseJournal rendu silencieux sur une ligne illisible fait rougir un seul test (17 verts, 1 rouge) ; le garde de saut de ligne final retiré en fait rougir un autre, seul. Restaurés : 18/18.
- **Réserve** : Les 51 entrées d'amorçage portent source=reconstructed : leur horodatage est celui d'un commit réel, pas l'heure à laquelle l'agent a travaillé. Les entrées d'audit, qui ne produisent aucun commit, sont calées sur le commit de correction qui en découle.
- **Réserve** : L'outil ne vérifie pas qu'un SHA cité existe réellement dans le dépôt : il valide la forme, pas l'existence.
