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
