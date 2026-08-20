# Task 7 — Rapport d'implémentation

## Fichiers créés / modifiés

- `prisma/seed.ts` (créé) — verbatim du brief.
- `src/server/orders.ts` (créé) — verbatim du brief (`creerCommande`, `RuptureStockError`).
- `tests/server/orders.test.ts` (créé) — verbatim du brief, 5 tests.
- `package.json` (modifié) — ajout de la clé `"prisma": { "seed": "node --experimental-strip-types prisma/seed.ts" }`.
  Écart volontaire par rapport au brief : le brief demande d'installer `tsx` et d'utiliser
  `"prisma": { "seed": "tsx prisma/seed.ts" }`. Consigne explicite reçue : ne pas installer de
  paquet (environnement stabilisé, aucune installation autorisée) et utiliser Node 22 en mode
  natif TypeScript. Aucune autre clé de `package.json` n'a été touchée.

## Écart identifié et non modifié

Le brief liste `effetSurStock` comme dépendance consommée dans la section Interfaces, mais le
code fourni (verbatim, Step 4) ne l'appelle jamais : il code en dur l'équivalent (décrément
seulement si `statutInitial === 'confirmee'`). C'est cohérent — `effetSurStock` prend une paire
`(de, vers)` de transition, or la création de commande n'a pas d'état "de" (pas de transition,
juste un état initial) : il n'y avait donc pas d'appel raisonnable à faire. J'ai conservé le code
verbatim tel que fourni, sans forcer un appel à `effetSurStock` qui n'a pas de sens ici.

## Exécution du seed

Commande utilisée : `node --experimental-strip-types prisma/seed.ts` (au lieu de
`npx prisma db seed`, conformément à la consigne — la commande `prisma.seed` de `package.json`
a cependant été mise à jour pour que `npx prisma db seed` fonctionne aussi si besoin plus tard).

Sortie exacte :
```
(node:34852) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:34852) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///D:/Projet/summerclub/prisma/seed.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to D:\Projet\summerclub\package.json.
```
Seulement des avertissements Node, aucune erreur. Vérifié en base via `psql` :
- `Variant.VAH-45.stock = 5`
- `Product.collier-vahine.prixBase = 45000`
- `DeliveryZone.zone-tana.tarif = 5000`

## Étape « le test doit échouer d'abord »

`npm test -- tests/server/orders.test.ts` avant d'écrire `src/server/orders.ts` :
```
FAIL  tests/server/orders.test.ts [ tests/server/orders.test.ts ]
Error: Cannot find package '@/server/orders' imported from D:/Projet/summerclub/tests/server/orders.test.ts
Test Files  1 failed (1)
     Tests  no tests
```
Échec pour la bonne raison (module absent), conforme à l'attendu du brief.

## Étape « les 5 tests passent »

Après écriture de `src/server/orders.ts` :
```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

Note sur un faux positif rencontré une seule fois : lors du tout premier lancement isolé de
`orders.test.ts` juste après le seed, le premier test a timeout à 5000ms (timeout par défaut de
vitest) — connexion Prisma/Postgres à froid. Rejoué immédiatement avec `--testTimeout=20000`,
les 5 tests passent en ~1s. Rejoué ensuite avec le timeout par défaut (aucune modification de
code ni de test) : passe en 1.2s. Confirmé reproductible-stable sur les exécutions suivantes
(plusieurs runs consécutifs, voir plus bas). Ce n'est pas le test de concurrence, et ce n'est pas
un signe de verrouillage défaillant — c'est un coût de connexion initiale ponctuel qui ne s'est
plus reproduit. Je ne l'ai pas neutralisé ni caché : je le rapporte tel quel.

## Suite complète

`npm test` (après ajout des 5 tests) :
```
Test Files  7 passed (7)
     Tests  66 passed (66)
```
61 tests préexistants + 5 nouveaux = 66. Aucune régression.

## `tsc --noEmit`

`npx --no-install tsc --noEmit` → aucune sortie, aucun code d'erreur : pas d'erreur de type.

## Test de concurrence — trois exécutions consécutives

Commande : `npx vitest run tests/server/orders.test.ts -t "ne survend jamais sous accès concurrent"`,
exécutée trois fois de suite (le test réinitialise le stock à 1 dans son propre corps via
`variantTest(1)`, donc chaque run repart d'un état propre).

- Run 1 : `Tests  1 passed | 4 skipped (5)` — succès, une seule des trois tentatives concurrentes aboutit.
- Run 2 : `Tests  1 passed | 4 skipped (5)` — succès.
- Run 3 : `Tests  1 passed | 4 skipped (5)` — succès.

Dans les trois cas, `Promise.allSettled` sur 3 tentatives concurrentes ne laisse passer qu'une
seule commande, et le stock final de la variante est bien `0`. Aucune intermittence observée.

## Auto-revue

- Le verrouillage se fait par `SELECT ... FOR UPDATE` sur les lignes `Variant` concernées, avant
  toute lecture de stock utilisée pour la décision, dans un ordre stable (`ORDER BY id` après tri
  des ids côté JS) — évite les interblocages entre transactions concurrentes qui verrouilleraient
  les mêmes variantes en ordre inverse.
- Niveau d'isolation `Serializable` explicite sur `prisma.$transaction`.
- Le prix ne vient jamais du client : `resolvePrix` est appelé côté serveur à partir de
  `variant.product.prixBase + variant.deltaPrix` lus dans la transaction ; l'input `creerCommande`
  ne contient aucun champ prix.
- `OrderItem.nomFige` / `prixUnitaireFige` sont écrits une fois à la création et ne sont plus
  jamais recalculés depuis le produit — l'historique est figé par construction (aucun code de
  mise à jour ultérieure n'existe dans ce module).
- La contrainte `CHECK (stock >= 0)` en base reste un filet de sécurité : le contrôle
  `variant.stock < ligne.quantite` dans la transaction verrouillée est la première ligne de
  défense réelle contre la survente.
- Aucune fonction hors périmètre ajoutée (pas d'annulation, pas de changement de statut, pas
  d'envoi d'e-mail).
- Le schéma `@@unique([productId, libelle])` sur `Variant` n'a pas eu d'impact ici : le seed ne
  crée qu'une seule déclinaison (`45 cm` / `VAH-45`), donc aucun conflit possible.

## Écarts avec le brief (résumé)

1. `package.json` : commande de seed en `node --experimental-strip-types` au lieu de `tsx`,
   aucune installation de paquet — consigne explicite du contexte de tâche.
2. `effetSurStock` non appelé dans `orders.ts` malgré sa mention en Interfaces — code repris
   verbatim du brief, l'appel n'a pas de sens pour une création (pas de transition d'état).

Aucun autre écart. Le code du seed, des tests et de `orders.ts` est repris verbatim du brief.

## Correction — validation, isolation, réservation et couverture

Revue approfondie de `src/server/orders.ts` demandée en dehors du plan de tâches initial :
trois défauts critiques et plusieurs défauts importants ont été démontrés puis corrigés.

### Correctifs appliqués

1. **Validation des entrées (critique).** `creerCommande` refuse désormais, avant l'ouverture
   de la transaction, un panier vide (`PanierVideError`) et toute `quantite` qui n'est pas un
   entier strictement positif ≤ 20 (`QuantiteInvalideError`). Corrige l'exploit démontré :
   `quantite = -5` produisait `stock = stock - (-5)`, donc créait du stock et un total négatif.

2. **Isolation ↔ verrouillage (critique).** Retrait de `{ isolationLevel: 'Serializable' }`,
   incompatible avec le `SELECT … FOR UPDATE` de la même transaction (une transaction bloquée
   sur le verrou en Serializable est avortée en 40001 plutôt que d'attendre). En Read Committed
   (défaut), la transaction bloquée obtient le verrou, relit la ligne fraîche via `tx`, et sert
   la cliente s'il reste du stock. Ajout de `{ timeout: 15000, maxWait: 5000 }`. La relecture des
   variantes se fait bien après le `FOR UPDATE`, via `tx` uniquement.

3. **Agrégation des quantités (critique).** Les quantités sont désormais agrégées par
   `variantId` (Map) avant le contrôle de stock et avant l'écriture des lignes de commande. Deux
   lignes de panier sur la même déclinaison ne peuvent plus chacune passer un contrôle sur
   l'ancien stock puis décrémenter deux fois. Une déclinaison commandée en plusieurs lignes
   produit une seule `OrderItem` à quantité agrégée.

4. **Réservation du stock au paiement en ligne (critique, décision validée).** Le canal
   `orange_money` réserve désormais le stock dès la création (statut `en_attente_paiement`), au
   même titre que `livraison`. Le canal `whatsapp` ne réserve rien. `en_attente_paiement` a été
   ajouté à `STOCK_ENGAGE` dans `src/domain/order-status.ts`, avec un commentaire expliquant
   pourquoi. Conséquences vérifiées par test dans `order-status.test.ts` :
   `en_attente_paiement → confirmee` = `aucun` (pas de double décompte),
   `en_attente_paiement → echec_paiement` = `recrediter`,
   `en_attente_paiement → annulee` = `recrediter`,
   `en_attente_confirmation → confirmee` = `decrementer` (inchangé),
   `en_attente_confirmation → annulee` = `aucun` (inchangé, rien n'avait été réservé).
   Seuls les deux tests existants portant sur `en_attente_paiement` ont été modifiés ; les autres
   tests du fichier, y compris l'invariant sur les 81 couples, n'ont pas été touchés.

5. **Produits et zones désactivés (important).** `creerCommande` refuse un `Product.actif =
   false` (`ProduitIndisponibleError`) et une `DeliveryZone.actif = false` ou inexistante
   (`ZoneInvalideError`).

6. **Erreurs métier typées (important).** Nouvelle famille dérivée de `CommandeError` :
   `RuptureStockError` (signature inchangée), `PanierVideError`, `QuantiteInvalideError`,
   `VariantIntrouvableError`, `ProduitIndisponibleError`, `ZoneInvalideError`. Une déclinaison
   inexistante ne remonte plus un `P2025` brut, une zone inexistante ne remonte plus une
   violation de clé étrangère.

7. **Test de concurrence durci (important).** Le test `ne survend jamais sous accès concurrent`
   vérifie maintenant explicitement que les tentatives rejetées échouent avec
   `RuptureStockError` (et non un conflit de sérialisation). Ajout d'un test de non-régression :
   deux commandes concurrentes sur un stock de 5 réussissent toutes les deux.

8. **Couverture du prix figé (important).** Ajout d'un test avec promotion active (`-10%`) et
   déclinaison à `deltaPrix ≠ 0`, vérifiant que `prixUnitaireFige` est bien le prix remisé de la
   déclinaison (48000 → 43200), et d'un test de figement historique : après création de la
   commande, modification de `Product.prixBase`, la ligne de commande ne bouge pas. Données de
   test nettoyées en fin de cas (promotion supprimée, `deltaPrix`/`prixBase` restaurés).

9. **Divers (mineurs).** `reference()` passe de 4 à 6 octets aléatoires. `prisma/seed.ts` :
   l'`upsert` de la déclinaison n'écrase plus le stock à chaque exécution (`update: {}`), et
   `main()` porte désormais un `.catch()` qui journalise puis force `process.exitCode = 1`.
   `creerCommande` a un type de retour explicite (`Promise<CommandeCreee>`).

Tests ajoutés au-delà des exigences du correctif 4/7/8, pour couvrir expérimentalement les
correctifs 1, 3, 5 et 6 (quantité négative sans recrédit, panier vide, agrégation de lignes
dupliquées, réservation par canal, produit/zone désactivés, déclinaison/zone inexistante).

### Vérification

1. `npm test -- tests/domain/order-status.test.ts` → 18 tests passés (1 fichier).
2. `npm test -- tests/server/orders.test.ts`, exécuté trois fois de suite → 19 tests passés à
   chaque exécution, aucune intermittence observée.
3. `npm test` (suite complète) → 82 tests passés (7 fichiers) ; 66 tests de départ + 16
   nouveaux (aucune régression hors les 2 tests d'`en_attente_paiement` modifiés comme prévu par
   le correctif 4).
4. `npx --no-install tsc --noEmit` → aucune sortie, aucune erreur de type.

Fichiers modifiés : `src/server/orders.ts`, `src/domain/order-status.ts`,
`tests/server/orders.test.ts`, `tests/domain/order-status.test.ts`, `prisma/seed.ts`.
Aucun autre fichier touché. Aucun `npm install` lancé.

Commit : `94dba59` — *fix: valide les entrées, corrige l'isolation transactionnelle et réserve
le stock au paiement orange_money*.

### Réserves

- Le test de concurrence (correctif 7) attend deux issues précises (1 succès + 2
  `RuptureStockError`, puis 2 succès sur stock=5) ; il reste, par nature, sensible au
  comportement du pool de connexions Prisma sous charge plus élevée que 2-3 requêtes
  simultanées — non testé au-delà de ce que demandait le brief.
- `ZoneInvalideError` couvre à la fois « zone désactivée » et « zone inexistante » avec le même
  type d'erreur (le brief ne demandait pas de les distinguer) ; à séparer si un appelant a
  besoin de messages différents.
- Aucun mécanisme d'idempotence webhook n'a été ajouté ; `effetSurStock` documente déjà qu'il ne
  protège pas contre le rejeu d'un même événement, ce point reste à la charge de l'appelant du
  webhook de paiement (hors périmètre de cette correction).
