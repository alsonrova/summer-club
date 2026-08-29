# Conventions du dépôt Summer Club

**Ce document fait autorité.** Tout agent qui travaille sur ce dépôt — humain ou modèle de
langage — s'y conforme. En cas de contradiction entre ce document et un brief, un plan, une
habitude venue d'ailleurs ou l'usage d'un autre projet, **c'est ce document qui l'emporte** ;
signalez la contradiction plutôt que de la trancher en silence.

## 0. Le projet est indépendant

Summer Club ne se fonde sur les normes d'aucun autre projet. Les conventions de ce dépôt
sont celles écrites ici, et rien d'autre.

Concrètement, trois réflexes :

- **Ne transposez pas une norme d'un autre dépôt** parce qu'elle y était bonne. Si une règle
  vous paraît manquer ici, proposez-la ici ; ne l'appliquez pas d'office.
- **Ne suivez pas votre mémoire de la bibliothèque, lisez la version installée.** Ce projet
  s'est déjà fait piéger trois fois par de la mémoire périmée : `_def.typeName` de zod 3 qui
  vaut `undefined` en zod 4.4.3 et aurait classé tous les champs de formulaire en texte,
  silencieusement (tâche 10) ; `url = env()` supprimé par Prisma 7, d'où l'épinglage en
  6.19.3 (tâche 2) ; le champ `issuer` de Better Auth 1.7.x, absent de la documentation
  connue (tâche 9). La bonne source est `node_modules/`, pas le souvenir. Next.js va jusqu'à
  l'écrire lui-même en tête de `AGENTS.md`.
- **`AGENTS.md` est réécrit automatiquement par `next dev`.** Ne comptez pas dessus comme
  support de convention et ne vous étonnez pas de le voir réapparaître modifié. Le point
  d'entrée durable est `CLAUDE.md`, qui pointe ici.

## 1. Langue : l'anglais s'arrête aux identifiants

La règle est nette et la frontière ne bouge pas.

**En anglais — ce que seule la machine lit :**

| Quoi | Exemple réel |
| --- | --- |
| Noms de variables, de fonctions, de types | `defineResource`, `PromotionRule`, `DelegatePrisma<T>`, `ResourceConfig<T>` |
| Noms de fichiers et de dossiers | `src/server/order-status-service.ts`, `src/domain/pricing.ts` |
| Modèles, champs et énumérations de base | `Product.slug`, `Variant.stock`, `OrderItem`, `Media` |
| Clés d'objets techniques et de configuration | `testsBefore`, `findings`, `schemaVersion` |

**En français — tout ce qu'un être humain lit :**

| Quoi | Exemple réel |
| --- | --- |
| Libellés d'interface | « Prix », « Catégorie », « Enregistrement… » |
| Messages d'erreur affichés | « Le nom est requis », « Statut inconnu » |
| Messages de validation | `z.config(fr())` dans `src/admin/resource.ts` |
| Commentaires de code | tout le dépôt |
| Messages de commit | `fix: pose le garde de type manquant sur l'épinglage` |
| Documentation, rapports, journal | ce fichier |

Ce n'est pas une préférence esthétique : c'est une boutique malgache, la spécification
impose le français à l'interface, et **les tests de bout en bout ciblent ces libellés**
(`getByRole('button', { name: 'Se connecter' })`). Traduire un libellé casse une suite.

**État actuel, à ne pas confondre avec la règle.** Une bonne partie du code existant porte
des identifiants français ou mixtes — `appliquerStatut`, `listerProduitsPagines`, `STATUTS`,
`champsSysteme`, `resolvePrix`, et les colonnes `nom`, `prixBase`, `deltaPrix`,
`joursSemaine`. Ils précèdent cette règle. **Le renommage est un travail
séparé, gouverné par ce document — ne renommez rien en passant.** Un renommage opportuniste
au milieu d'une tâche fonctionnelle rend la revue impossible et casse les tests de bout en
bout sans que personne ne sache pourquoi. Le code neuf, lui, suit la règle dès maintenant.

## 2. Architecture : quatre couches, une seule direction

Les couches existent déjà et portent leur sens. La règle ne fait que graver ce que le code
fait — et pourquoi.

```
src/app/      interface et points d'entrée (pages, Server Actions, Route Handlers)
src/admin/    moteur d'administration piloté par schéma
src/server/   accès aux données et services
src/domain/   logique métier pure
```

**Règle de dépendance : une couche ne connaît que celles en dessous d'elle.** `src/domain/`
n'importe jamais `src/server/` ; `src/server/` n'importe jamais `src/app/`. Un import qui
remonte est un défaut, pas un raccourci.

### `src/domain/` — pur, et pur pour une raison

Pas de base, pas de réseau, **pas d'horloge**. Le temps arrive en paramètre :
`resolvePrix({ …, maintenant: Date })`, jamais `new Date()` à l'intérieur. Sans cela, on ne
peut pas tester une happy hour qui franchit minuit sans déplacer l'horloge de la machine —
et c'est précisément le cas qu'aucun test ne couvrait avant la revue de la tâche 4.

La pureté a une contrepartie qu'il faut connaître : une fonction pure est **sans mémoire**.
`effetSurStock(de, vers)` appelée deux fois renvoie deux fois le même effet. Elle ne protège
donc contre aucun rejeu — webhook livré deux fois, double clic en back-office. Cette
protection appartient à l'appelant (voir § 5).

### `src/server/` — les données, et rien de l'interface

C'est ici que vivent Prisma, les transactions, l'authentification, le traitement des images
et le journal d'audit. Deux exigences :

- **Le cœur métier d'une opération ne connaît pas l'authentification.**
  `appliquerStatut()` (`src/server/order-status-service.ts`) n'appelle pas `requireAdmin()` :
  le webhook de paiement de la tâche 19 n'est pas une administratrice et appellera la même
  fonction. C'est `changerStatut()` (`src/app/admin/commandes/actions.ts`) qui authentifie
  puis délègue.
- **Ce qui exige un contexte de requête reste hors du cœur.** `appliquerStatut` n'appelle pas
  `revalidatePath` — mesuré sous Vitest, cela lève « Invariant: static generation store
  missing ». Le module publie `cheminsARevalider(orderId)` pour que ses deux appelants
  n'aient rien à deviner ni à oublier.

### `src/app/` — les points d'entrée, donc la sécurité

Voir § 4 : c'est ici que la protection se pose, sur **chaque** point d'entrée.

### `src/admin/` — un moteur, pas des écrans

`defineResource` dérive champs, colonnes et filtres d'un schéma Zod ; `AdminTable` et
`AdminForm` n'en sont que les vues. Ajouter un écran d'administration se fait en décrivant
une ressource, pas en modifiant le moteur.

### Hors de `src/`

`tools/` contient l'outillage de projet (voir `docs/journal/README.md`). Il n'entre ni dans
le build de l'application ni dans le `tsconfig` de production, et n'a le droit d'ajouter
aucune dépendance npm : Node et ses modules natifs suffisent.

## 3. SOLID, illustré par ce dépôt

Chaque principe est illustré par du code qui existe ici. Aucun exemple de manuel : si vous
ajoutez un principe à cette liste, ajoutez avec lui le fichier qui le porte.

### S — Responsabilité unique

Le changement de statut d'une commande est réparti sur trois fichiers, et chacun a **une
seule raison de changer** :

| Fichier | Sa seule responsabilité |
| --- | --- |
| `src/domain/order-status.ts` | ce qui est permis (table de transitions, effet sur le stock) |
| `src/server/order-status-service.ts` | verrouiller, relire, décider, écrire — dans une transaction |
| `src/app/admin/commandes/actions.ts` | authentifier, traduire les erreurs en français, invalider les caches |

Une règle métier qui change ne touche que le premier. Un changement d'authentification ne
touche que le troisième.

Corollaire concret : `src/app/admin/produits/etats.ts` existe séparément de `actions.ts`
parce qu'un fichier `'use server'` ne peut exporter que des fonctions asynchrones. La
contrainte technique a rejoint la bonne découpe — les types d'état ne sont pas des actions.

### O — Ouvert à l'extension, fermé à la modification

`defineResource` (`src/admin/resource.ts`) dérive champs de formulaire, colonnes et filtres
d'un schéma Zod. Un nouvel écran d'administration s'ajoute en **décrivant une ressource**
(`src/admin/resources/products.ts`, `orders.ts`, `variants.ts`) sans toucher au moteur
(`engine/table.tsx`, `engine/form.tsx`, `engine/actions.ts`).

Les points d'extension sont déclarés, pas bricolés : `libelles` surcharge la capitalisation
automatique quand `categoryId` n'est pas présentable, `champsSysteme` surcharge la liste des
colonnes gérées par la base. Aucun `if (resource.name === 'produits')` dans le moteur.

### L — Substitution de Liskov

La famille `CommandeError` (`src/server/orders.ts`) : `RuptureStockError`,
`QuantiteInvalideError`, `PanierVideError`, `ZoneInvalideError`,
`ProduitIndisponibleError`, `VariantIntrouvableError` — et `TransitionInterditeError`,
déclarée ailleurs (`src/server/order-status-service.ts`) mais dérivée de la même base.

Le contrat que toutes tiennent : *« je suis une faute métier rattrapable, pas une panne
technique »*. `CommandeError` pose `this.name = new.target.name` dans son constructeur, donc
chaque sous-classe se nomme elle-même sans avoir à le redire ; et la base sert de frontière —
`changerStatutDepuisFormulaire` (`src/app/admin/commandes/actions.ts`) traduit en français
les erreurs qu'elle attend et **relaie tout le reste tel quel**, y compris la redirection de
`requireAdmin()`, qui s'implémente par un `throw` et ne doit surtout pas être avalée.

Ce qui rend la substitution réelle : `TransitionInterditeError` est déclarée dans un autre
fichier (`src/server/order-status-service.ts`) et l'appelant n'a rien eu à changer pour
l'accueillir. Une nouvelle erreur métier qui dériverait d'`Error` au lieu de `CommandeError`
romprait le contrat : elle remonterait comme une panne technique. Même schéma pour `AvisError`
(`src/server/reviews.ts`).

**État actuel, à ne pas embellir :** l'action d'administration attrape aujourd'hui les deux
sous-classes concrètes qu'elle sait traduire (`RuptureStockError`, `TransitionInterditeError`),
pas `CommandeError` en bloc. La base rend ce `catch` unique possible — elle n'est pas encore
utilisée ainsi.

### I — Ségrégation des interfaces

`DelegatePrisma<T>` (`src/admin/engine/actions.ts`) déclare **exactement les quatre méthodes
que le moteur utilise** — `findUnique`, `create`, `update`, `delete` — au lieu de dépendre de
`PrismaClient` entier :

```ts
export type DelegatePrisma<T> = {
  findUnique: (args: { where: { id: string } }) => Promise<(T & { id: string }) | null>
  create: (args: { data: T }) => Promise<T & { id: string }>
  update: (args: { where: { id: string }; data: Partial<T> }) => Promise<T & { id: string }>
  delete: (args: { where: { id: string } }) => Promise<T & { id: string }>
}
```

Ce n'est pas de la théorie : c'est ce qui permet à `tests/admin/champs-systeme.test.ts` de
passer un delegate factice et de vérifier qu'un `id` forgé n'atteint jamais l'écriture, sans
base de données.

### D — Inversion des dépendances

- `creerRessource(resource, delegate, formData)` : le moteur **ne va pas chercher** son
  delegate Prisma, il le reçoit. Le module haut niveau dépend d'un type abstrait, pas d'un
  modèle concret.
- `enregistrerAudit(args, client = prisma)` : `appliquerStatut` lui **injecte son propre
  client de transaction**, de sorte que la trace ne survive pas à un `ROLLBACK`. Le module
  d'audit ne connaît ni la transaction ni l'appelant.
- Le sens des dépendances entre couches (§ 2) est lui-même une inversion : `src/server/`
  dépend des types de `src/domain/` (`Statut`, `transitionAutorisee`), jamais l'inverse.

**Point ouvert, à ne pas confondre avec du livré :** l'interface `PaymentProvider` décrite
dans le plan (`docs/superpowers/plans/2026-08-12-summerclub-v1.0.md`, tâche 17) sera le
meilleur exemple d'inversion de ce projet — le domaine du paiement dépendra d'une abstraction
et non d'Orange Money. **Elle n'existe pas encore dans le code.** Elle est citée ici comme
intention consignée, pas comme exemple réel.

## 4. Sécurité : les règles acquises, chacune payée par un incident

Ces règles ne sont pas des principes généraux. Chacune vient d'un défaut réellement trouvé
dans ce dépôt.

1. **Toute page, toute Server Action et tout Route Handler d'administration appelle
   `requireAdmin()` lui-même, en première instruction.** Un layout ne suffit pas : il n'est
   pas ré-exécuté à chaque navigation (rendu partiel), il ne s'exécute pas sur une route
   inexistante, et il ne protège ni les actions ni les gestionnaires de route. La lecture de
   session est mise en cache par requête (`cache()` de React) : ce doublon ne coûte rien.
   Le proxy (`src/proxy.ts`) et le layout sont de la défense en profondeur, pas la défense.

2. **Un garde-fou posé dans un composant client ne protège rien.** Une Server Action exportée
   est un point d'entrée POST invocable hors de l'interface. L'invariant « pas d'épinglage
   d'un avis non publié » ne vivait que dans le composant client : le scénario des deux
   onglets était reproductible. Tout invariant se ferme côté serveur.

3. **Toute valeur venue du client est validée avant d'atteindre la base**, même quand une
   couche plus basse la rejetterait. `estStatut(vers)` refuse une valeur forgée avant qu'elle
   n'atteigne l'énumération PostgreSQL, avec un message compréhensible plutôt qu'une erreur
   SQL brute. Motif à surveiller, observé deux fois : **une passe de correction ferme un cas
   et laisse son symétrique ouvert, dans le même fichier.** Après avoir corrigé un champ,
   cherchez son jumeau.

4. **La contrainte de base est un filet de sécurité, jamais la première ligne de défense.**
   `variant_stock_non_negatif` existe et doit exister ; mais si c'est elle qui rattrape le
   cas, la propriétaire reçoit une `PrismaClientUnknownRequestError` au lieu d'un message.
   Le contrôle métier passe avant.

## 5. Argent et concurrence

1. **Les montants sont des entiers d'Ariary. Jamais de flottant, jamais de centimes.**
   `Int` en base, `number` entier en TypeScript, affichage `45 000 Ar` avec espace
   insécable U+00A0 et sans décimale. Écrivez-la en séquence d'échappement (`\u00A0`) dans
   le code : un relecteur a déjà signalé à tort des espaces ordinaires parce que le
   caractère est invisible.

2. **Ne jamais combiner `isolationLevel: 'Serializable'` avec `SELECT … FOR UPDATE`.** Sous
   Serializable, une transaction bloquée sur le verrou ne l'obtient jamais : PostgreSQL
   l'avorte en 40001. Mesuré sur ce projet, stock de 5, deux clientes simultanées : **une
   vente sur deux rejetée à tort.** Read Committed (le défaut) avec `FOR UPDATE`.

3. **Une décision qui touche l'inventaire se prend sur l'état RELU en base, à l'intérieur de
   la transaction** — jamais sur un état reçu en paramètre. Verrouiller, relire, décider,
   écrire, dans cet ordre et dans une seule transaction. C'est ce qui rend un second appel
   inoffensif : il voit le statut déjà écrit et se heurte à `TransitionInterditeError` au lieu
   de rejouer l'effet sur le stock. Verrouillez aussi la ligne de commande elle-même : sans
   ce verrou, deux annulations concurrentes recréditaient le stock deux fois.

4. **Une trace d'audit qui accompagne une écriture transactionnelle s'écrit dans la même
   transaction.** Écrite avec le client global, elle survivait à un `ROLLBACK` :
   `enregistrerAudit(args, tx)` accepte le client de transaction pour cette raison.

## 6. Tests

1. **TDD.** Le test est écrit d'abord, et **vu rouge**, avant l'implémentation.

2. **Un test qui ne rougit pas quand on casse ce qu'il protège ne protège rien.** Les tests
   des chemins sensibles — stock, argent, statuts, authentification — se valident **par
   mutation** : on casse volontairement le code protégé, on vérifie que le test rougit
   **seul**, on restaure. Exemple réel : contrôle de stock de la confirmation retiré, le test
   « lève `RuptureStockError` quand le stock est parti entre-temps » rougit seul, sur
   `PrismaClientUnknownRequestError` — c'est-à-dire la contrainte CHECK à la place du contrôle
   métier. Restauré : 13/13.

3. **Ne jamais masquer une intermittence par une sérialisation, un plafond de workers, un
   retry ou un délai. Cherchez la cause.** Deux fois sur ce projet la cause était un test qui
   possédait mal ses données : un `afterAll` exécuté **une fois par worker** qui supprimait
   les lignes des autres tests, et deux fichiers faisant `deleteMany()` sur les mêmes lignes
   en parallèle. Chaque fichier de test possède ses propres lignes (slug ou SKU dérivé de son
   identité) et n'assère que sur elles. Le retrait des contournements a fait passer la suite
   de 25 s à environ 9 s.

4. **Le conteneur PostgreSQL s'arrête tout seul sur cette machine.** Symptôme trompeur : une
   vingtaine de tests échouent d'un coup comme s'il y avait une régression. Réflexe, AVANT de
   suspecter le code :
   `docker exec docker-db-1 pg_isready -U summerclub -d summerclub`, puis au besoin
   `docker compose -f docker/compose.dev.yml up -d`. Une affirmation « la branche est
   cassée » a déjà été portée à tort pour cette seule raison.

5. **`next dev` ne répond pas sur cette machine.** Playwright vise `npm run start` : un
   `npm run build` doit précéder.

## 7. Vérification avant de déclarer terminé

Trois commandes obligatoires, dans cet ordre, avec leurs sorties réelles rapportées :

```
npm test                        # suite Vitest complète
npx --no-install tsc --noEmit   # typage strict + noUncheckedIndexedAccess
npm run build                   # build de production
```

Une quatrième dès que l'interface a bougé — elle exige le build ci-dessus, `next dev` ne
servant rien sur cette machine :

```
npx --no-install playwright test
```

**N'affirmez que ce que vous avez vérifié.** Les revues de ce projet ont pris trois
affirmations fausses en flagrant délit sur la seule tâche 12 : une couverture annoncée qui
n'existait pas, un test censé couvrir l'audit transactionnel mais qui s'arrêtait avant de
l'atteindre, et une base « laissée propre » que le paragraphe de réserves du même document
contredisait. Un chiffre non mesuré se laisse en blanc.

**Ne citez jamais un identifiant de commit pour désigner l'état courant.** Un document
versionné AVEC le changement qu'il décrit ne peut pas contenir le SHA du commit qui le
contient : il sera toujours en retard d'un cran. Écrivez « pour la tête exacte : `git log -1` ».

## 8. Rôles d'agents

Quatre rôles. Un agent en tient un seul à la fois, et sait lequel.

### Développeur

Implémente en TDD. Rapporte des chiffres **vérifiés** : nombre de tests avant et après,
sorties exactes des commandes, commit produit. N'affirme que ce qu'il a vérifié, et écrit
noir sur blanc ce qu'il n'a pas pu vérifier.

**Produit** : le code, ses tests, le commit, et un rapport contenant — les écarts par rapport
au brief avec leur justification, les sorties exactes des commandes de vérification (§ 7),
et une section de réserves qui ne contredit pas le reste du document.

### Auditeur qualité et sécurité

**Indépendant du développeur. Sa mission est de critiquer**, pas de valider. Un audit qui ne
trouve rien doit pouvoir dire ce qu'il a cherché.

Liste de contrôles concrets, tirée de ce que les revues de ce projet ont **réellement**
trouvé :

- **Valeurs forgées atteignant la base sans garde.** Chaque Server Action exportée est une
  route POST publique. Suivez chaque paramètre depuis le client jusqu'à Prisma. Une quantité
  négative a créé du stock ici (total de -220 000 Ar observé).
- **Invariants posés seulement côté client.** Cherchez chaque règle affichée dans un composant
  et vérifiez qu'elle existe aussi côté serveur. Scénario de référence : deux onglets ouverts.
- **Le symétrique du cas déjà corrigé.** Une passe précédente a fermé `statut` et laissé
  `epingle`, dans le même fichier.
- **Tests qui s'arrêtent à leur garde d'entrée.** Un test qui vérifie qu'une action refuse un
  anonyme ne couvre pas ce que l'action fait ensuite. Lisez le corps du test, pas son nom.
- **Affirmations fausses dans les rapports.** Recoupez chaque chiffre avec une exécution
  réelle, et chaque « couvert par un test » avec le corps du test. Comparez le résumé d'un
  rapport avec ses propres réserves : ils se contredisent parfois.
- **Contournements déguisés en corrections.** `retry`, `mode: 'serial'`, `fileParallelism:
  false`, plafond de workers, `sleep` : tout cela masque une cause au lieu de la traiter.
- **Diagnostics repris sans preuve.** Une revue de ce projet a diagnostiqué une « concurrence
  des Server Actions » qui n'existait pas ; la fausse cause s'est propagée dans trois
  documents, dont une passation versionnée. Un diagnostic se démontre ou s'annonce comme
  hypothèse.
- **Isolation transactionnelle, verrous, ordre lecture/décision/écriture** (§ 5).
- **Flottants sur des montants**, `Float` ou `Decimal` dans un schéma, division non arrondie.
- **Secrets et gabarits** : `.env.example` a déjà proposé un secret de 43 caractères qui
  passait tous les contrôles.

**Produit** : une liste de constats classés Critique / Important / Mineur, chacun avec le
fichier et la ligne, **le scénario concret qui le déclenche**, et ce qui prouve qu'il est réel.
Un constat sans scénario reproductible est annoncé comme suspicion, pas comme défaut.

### Testeur UX/UI

Vérifie **l'interface réelle dans un navigateur**, pas le code qui la produit. Ses contrôles
minimaux :

1. **Chaque bouton qui déclenche une action a un état visible pendant celle-ci** (désactivé,
   libellé « Enregistrement… », indicateur) **et redevient utilisable après** — y compris
   après une erreur. Un bouton resté bloqué sur « Enregistrement… » a déjà été observé ici.
2. **Chaque action aboutie donne un retour perceptible.** Une écriture qui réussit sans que
   rien ne change à l'écran est un défaut, même si la base est correcte.
3. **Chaque écran est vérifié en largeur mobile, tablette et bureau.** Un affichage responsive
   « prévu » mais jamais ouvert dans une fenêtre étroite ne compte pas comme vérifié.
4. **Aucun défilement horizontal** à aucune de ces largeurs. Les tableaux larges défilent dans
   leur propre conteneur, pas la page.
5. **Le focus clavier reste visible**, et l'ordre de tabulation suit l'ordre visuel. Tout ce
   qui se fait à la souris se fait au clavier.
6. **Les messages d'erreur sont rattachés à leur champ** (`aria-invalid`, `aria-describedby`),
   pas seulement affichés en haut du formulaire.
7. **Les états vides, longs et en échec sont vus** : liste vide, nom de 80 caractères, image
   manquante, action refusée par le serveur.
8. **Les libellés sont en français** et le vocabulaire est celui de la propriétaire, pas celui
   du schéma (« Catégorie », pas « categoryId »).
9. **Double soumission** : cliquer deux fois vite ne crée pas deux enregistrements.
10. **`prefers-reduced-motion: reduce`** supprime bien les déplacements.
11. **Contrastes** : `--color-sage` (`#7C8B72`) est interdit pour du texte ; le texte accentué
    utilise `--color-sage-deep` (`#5E6B55`).

**Produit** : par écran, la largeur testée, ce qui a été cliqué, ce qui a été observé, et une
capture quand le défaut est visuel.

### Coordinateur

Découpe le travail, dispatche, arbitre les constats contradictoires, et **tient le journal**
(§ 9). Quand deux agents se contredisent, il tranche par une mesure, pas par autorité — et
consigne la mesure.

### Règle d'orchestration, apprise à nos dépens

**Les agents de vérification travaillent en lecture seule.** Aucune modification de fichier,
même temporaire, même avec promesse de restauration.

Pourquoi : trois vérificateurs ont été lancés en parallèle sur le **même arbre de travail**,
l'un d'eux autorisé à muter le code pour une preuve par mutation. Un autre a vu le garde-fou
de stock disparaître sous ses yeux et a conclu à un défaut critique inexistant. **Une
vérification par mutation se fait seule et séquentiellement**, jamais pendant qu'un autre
agent lit le même fichier.

## 9. Journal des agents

Toute intervention d'un agent se consigne dans `docs/journal/entries.jsonl`, via l'outil
`tools/agent-journal/` :

```
npm run journal -- add --task 13 --role developer --summary "…" --verdict delivered
npm run journal -- list --task 13
npm run journal:render
```

Mode d'emploi complet : `docs/journal/README.md`. Récapitulatif lisible :
`docs/journal/JOURNAL.md`.

Le journal est **versionné** et **append-only** : on corrige une entrée passée en en ajoutant
une qui la rectifie, jamais en réécrivant l'ancienne. Un champ dont la valeur n'est pas connue
reste **vide** — un journal qui invente est pire qu'un journal incomplet.
