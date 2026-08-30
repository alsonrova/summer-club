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
| Noms de fichiers et de dossiers **hors `src/app/`** | `src/server/order-status-service.ts`, `src/domain/pricing.ts`, `tools/agent-journal/store.mjs` |
| Fichiers **sous `src/app/`**, qui ne paraissent dans aucune URL | `page.tsx`, `layout.tsx`, `route.ts`, `actions.ts`, `query.ts` |
| Modèles et champs de base | `Product.slug`, `Variant.stock`, `OrderItem`, `Media` |
| Noms de types d'énumération **et leurs valeurs** | `OrderStatus.pending_payment` (cible ; voir plus bas) |
| Clés d'objets techniques et de configuration | `testsBefore`, `findings`, `schemaVersion` |

**En français — tout ce qu'un être humain lit :**

| Quoi | Exemple réel |
| --- | --- |
| Libellés d'interface | « Prix », « Catégorie », « Enregistrement… » |
| **Segments de route sous `src/app/`** | `admin/produits`, `admin/commandes`, `admin/avis`, `connexion`, `acces-refuse` |
| Messages d'erreur affichés | « Le nom est requis », « Statut inconnu » |
| Messages de validation | `z.config(fr())` dans `src/admin/resource.ts` |
| Commentaires de code | tout le dépôt |
| Messages de commit | `fix: pose le garde de type manquant sur l'épinglage` |
| Documentation, rapports, journal | ce fichier |

Ce n'est pas une préférence esthétique : c'est une boutique malgache, la spécification
impose le français à l'interface, et **les tests de bout en bout ciblent ces libellés**
(`getByRole('button', { name: 'Se connecter' })`). Traduire un libellé casse une suite.

### Les URL sont du français, parce qu'un être humain les lit

**Un nom de dossier sous `src/app/` n'est pas un nom de fichier : c'est un segment d'URL**,
donc une adresse que la cliente voit dans sa barre, lit, recopie et prononce au téléphone.
La règle générale tranche d'elle-même — ce qu'un être humain lit reste en français.

Concrètement, sous `src/app/` :

- **Les dossiers qui forment l'adresse sont en français** : les routes existantes sont
  `admin/produits`, `admin/produits/nouveau`, `admin/commandes`, `admin/avis`, `connexion`,
  `acces-refuse`, et la vitrine à venir ajoutera `boutique`, `panier`, `commande`, `suivi`.
  Sans accent ni espace : une URL s'écrit en ASCII minuscule avec des traits d'union
  (`acces-refuse`, pas `accès refusé`).
- **Les fichiers techniques qui les composent gardent le nom que le cadre leur impose** :
  `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`. On ne les choisit pas.
  Les fichiers voisins que nous choisissons, eux, suivent la règle anglaise dès lors qu'ils
  ne paraissent dans aucune URL : `actions.ts`, `query.ts` sont des noms techniques, pas des
  adresses. (`etats.ts` est un reste français ; il fait partie du lot à renommer.)
- **Ce qui ne paraît pas dans l'URL suit la règle anglaise** : groupes de routes entre
  parenthèses, et segments dynamiques entre crochets — `[id]`, `[...all]`. Attention
  toutefois : renommer un groupe de routes ne change aucune adresse, mais renommer un
  segment dynamique change le nom du paramètre que le code reçoit.
- **`src/app/api/` n'est pas une adresse que la cliente lit** : `api/auth/[...all]` est
  l'interface d'une bibliothèque, imposée par elle. Ces segments restent en anglais.

**Partout ailleurs, la règle anglaise s'applique sans exception** : `src/domain/`,
`src/server/`, `src/admin/`, `src/components/`, `src/styles/`, `tests/`, `tools/`, `e2e/`,
`prisma/`. Aucun de ces chemins n'atteint jamais un navigateur.

### Énumérations : le nom du type ET la valeur

Une valeur d'énumération est le point où cette frontière glisse le plus, parce qu'elle est
**deux choses à la fois** : un identifiant que la machine compare, et une donnée que la base
stocke. La tentation est de la traiter comme du contenu. **Décision du propriétaire : c'est
un identifiant. Le nom du type et ses valeurs passent en anglais lors du renommage, base
comprise.**

Ce qu'un être humain lit n'est jamais la valeur brute, c'est sa traduction affichée :
`LIBELLES_STATUT` (`src/admin/resources/orders.ts`) rend déjà `en_preparation` par
« En préparation », et `LIBELLES_TRANSITION` la rend par « Mettre en préparation » sur un
bouton. Cette indirection existe déjà partout, elle est le bon endroit pour le français, et
c'est elle qui rendra le renommage possible sans toucher à un seul libellé — donc sans
casser un seul test de bout en bout.

**État actuel des énumérations, à ne pas confondre avec la règle.** Le schéma en porte sept,
aux noms français — `Role`, `Canal`, `StatutCommande`, `PortePromo`, `TypePromo`,
`SourceAvis`, `StatutAvis` — avec des valeurs françaises (`en_attente_confirmation`,
`prete_retrait`, `echec_paiement`, `verifie`, `publie`, `rejete`, `membre`…). Une seule fait
exception, et c'est bien ce qui montre que la frontière avait glissé : `TypePromo` porte
déjà `percent` et `fixed`. **Les sept sont dans le lot à renommer**, valeurs comprises, avec
la migration Prisma qui va avec — la partie la plus délicate du renommage, puisqu'elle
touche des données déjà écrites.

### Ce qui reste à renommer

**État actuel, à ne pas confondre avec la règle.** Une bonne partie du code existant porte
des identifiants français ou mixtes — `appliquerStatut`, `listerProduitsPagines`, `STATUTS`,
`champsSysteme`, `resolvePrix`, et les colonnes `nom`, `prixBase`, `deltaPrix`,
`joursSemaine`. S'y ajoutent les sept énumérations avec leurs valeurs, et le fichier
`src/app/admin/produits/etats.ts`. Ils précèdent cette règle. **Le renommage est un travail
séparé, gouverné par ce document — ne renommez rien en passant.** Un renommage opportuniste
au milieu d'une tâche fonctionnelle rend la revue impossible et casse les tests de bout en
bout sans que personne ne sache pourquoi. Le code neuf, lui, suit la règle dès maintenant.

**Ce qui n'est PAS dans ce lot : les segments de route en français.** Ils sont conformes,
pas en retard. `admin/produits` ne deviendra jamais `admin/products`.

## 2. Architecture : quatre couches, une seule direction

Les couches existent déjà et portent leur sens. La règle ne fait que graver ce que le code
fait — et pourquoi.

```
src/app/      interface et points d'entrée (pages, Server Actions, Route Handlers)
src/admin/    moteur d'administration piloté par schéma
src/server/   accès aux données et services
src/domain/   logique métier pure
```

Trois emplacements ne sont pas des couches et n'entrent donc pas dans la règle de
dépendance ci-dessous, mais ils existent et il faut savoir où ranger ce qu'on écrit :

```
src/components/  composants partagés par plusieurs écrans, hors du moteur d'administration
src/styles/      tokens.css — la charte, importée par src/app/globals.css
src/proxy.ts     garde optimiste au bord de la requête, avant la résolution de route
```

`src/components/` sert ce qu'aucune couche ne possède en propre : un composant utilisé par
plusieurs écrans et qui n'appartient pas au moteur (`bouton-deconnexion.tsx`). Un composant
qui n'est utilisé que par un écran reste à côté de cet écran, dans `src/app/` — le sortir
« pour ranger » éloigne le code de son seul appelant.

`src/proxy.ts` est de la **défense en profondeur, pas la défense** : il ne vérifie que la
présence du cookie de session, ni sa validité ni le rôle. La protection réelle est
`requireAdmin()` sur chaque point d'entrée (§ 4, règle 1).

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

5. **Aucune donnée venue du client ne compose un chemin de fichier sans être réduite à une
   forme que nous avons choisie.** `path.join` normalise les `..` — il ne les borne pas : il
   calcule sagement le chemin qui sort du dossier cible et le rend sans se plaindre. Défaut
   réel de la tâche 8 : le nom de fichier fourni au téléversement n'était pas assaini,
   **traversée de chemin confirmée**. La forme à appliquer est un filtre par liste blanche,
   pas un nettoyage : `traiterImage` (`src/server/media.ts`) réduit le nom à
   `path.basename(...)` puis **refuse** tout ce qui ne correspond pas à `/^[A-Za-z0-9_-]+$/`.
   Refuser, pas corriger — un nom qu'on répare en silence est un nom qu'on n'a pas compris.
   Quand la valeur ne peut pas se réduire à un nom simple (sous-dossiers légitimes),
   la liste blanche ne suffit plus : il faut alors résoudre le chemin et vérifier qu'il reste
   sous le dossier cible. Enfin, **ce contrôle appartient à la fonction qui écrit, pas à son
   appelant** : c'est elle qui connaît le dossier cible, et c'est le seul endroit qu'un futur
   appelant ne peut pas oublier. (Même raisonnement pour le suffixe anti-collision, remonté
   de l'appelant vers `traiterImage` à la même tâche.)

6. **Ce qu'une bibliothèque ouvre par défaut est fermé explicitement, et la fermeture se
   vérifie de l'extérieur, par une requête.** Monter une bibliothèque d'authentification,
   c'est publier d'un coup un ensemble de routes que personne n'a écrites une par une.
   Défaut réel de la tâche 9 : `POST /api/auth/sign-up/email` était joignable **sans
   session** alors que l'inscription publique est interdite — un chemin d'écriture anonyme
   vers la base. Corrigé par `disableSignUp: true`. Deux conséquences à tenir : énumérez ce
   que la bibliothèque monte (dans `node_modules/`, pas de mémoire — § 0) et fermez ce qui
   n'est pas voulu ; puis **prouvez-le par un appel réel non authentifié**, pas par une
   relecture de la configuration. La même tâche a montré le symétrique : la protection
   n'était pas acquise par défaut, un groupe de routes étant invisible dans l'URL, une page
   posée au mauvais endroit aurait été publique **sans aucun symptôme**.

7. **Un gabarit de secret ne doit jamais être une valeur qui passe les contrôles, et le
   démarrage refuse un secret absent.** Défaut réel de la tâche 9 : `.env.example` proposait
   un secret de 43 caractères qui satisfaisait toutes les vérifications de la bibliothèque —
   un déploiement pouvait donc démarrer en production avec la **clé de signature publiée dans
   le dépôt**, et rien ne l'aurait signalé. Un gabarit se laisse vide, ou porte une valeur
   qu'un contrôle rejette ; et l'application refuse de démarrer plutôt que de se rabattre sur
   un défaut. La règle vaut pour tout secret, pas seulement celui-là : clé de signature, jeton
   d'API de paiement, mot de passe de base.

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

**Même raisonnement pour tout compteur.** Le nombre de tests d'une passation est faux au
moment même où le commit qui la porte ajoute des tests — la passation des tâches 1 à 12
annonçait « 222 tests (22 fichiers) » dans le commit qui en portait 240 sur 23. Un chiffre
n'a sa place dans un document versionné que **daté et présenté comme une mesure d'alors** ;
pour la valeur courante, renvoyez à la commande qui la donne, exactement comme on renvoie à
`git log -1` pour la tête. Le journal (§ 9), lui, est daté par nature : c'est le bon endroit
pour un chiffre mesuré, parce qu'il n'y prétend jamais décrire le présent.

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
- **Chemins de fichiers composés à partir d'une donnée du client.** Suivez chaque nom reçu
  jusqu'au `writeFile`. `path.join` normalise les `..` sans borner le résultat : la traversée
  de chemin de la tâche 8 est passée par là. Cherchez la liste blanche, et vérifiez qu'elle
  **refuse** au lieu de réparer — et qu'elle est posée dans la fonction qui écrit, pas chez
  son appelant.
- **Points d'entrée montés par une bibliothèque, ouverts par défaut.** Ils ne s'écrivent
  dans aucun fichier du dépôt : `POST /api/auth/sign-up/email` était joignable sans session
  alors que l'inscription publique est interdite (tâche 9). Énumérez ce que la bibliothèque
  monte en lisant `node_modules/`, puis **appelez la route sans session** — une lecture de la
  configuration ne prouve rien. Même question pour la protection : une page rangée au mauvais
  endroit peut être publique sans aucun symptôme visible dans l'URL.
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
  passait tous les contrôles de la bibliothèque — un déploiement pouvait donc démarrer en
  production avec la clé de signature publiée dans le dépôt (tâche 9). Vérifiez les deux
  moitiés : le gabarit ne doit pas être une valeur acceptable, **et** le démarrage doit
  refuser un secret absent au lieu de se rabattre sur un défaut.

**Produit** : une liste de constats classés Critique / Important / Mineur, chacun avec le
fichier et la ligne, **le scénario concret qui le déclenche**, et ce qui prouve qu'il est réel.
Un constat sans scénario reproductible est annoncé comme suspicion, pas comme défaut. Plus
**sa ligne `npm run journal -- add …` prête à exécuter**, qu'il n'exécute pas lui-même : il
est en lecture seule.

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
capture quand le défaut est visuel. Plus **sa ligne `npm run journal -- add …` prête à
exécuter**, qu'il n'exécute pas lui-même : il est en lecture seule.

### Coordinateur

Découpe le travail, dispatche, arbitre les constats contradictoires, et **tient le journal**
(§ 9). Quand deux agents se contredisent, il tranche par une mesure, pas par autorité — et
consigne la mesure.

C'est lui qui **inscrit les entrées des agents en lecture seule**, à partir de la ligne de
commande qu'ils lui remettent. Il les inscrit telles quelles : il n'a pas fait le travail, il
n'est pas en position d'en réécrire le résumé ni d'en adoucir les réserves.

**Produit** : les entrées de journal effectivement écrites (les siennes et celles qu'on lui a
remises), et l'arbitrage motivé de chaque contradiction.

### Règle d'orchestration, apprise à nos dépens

**Les agents de vérification travaillent en lecture seule.** Aucune modification de fichier,
même temporaire, même avec promesse de restauration.

Pourquoi : trois vérificateurs ont été lancés en parallèle sur le **même arbre de travail**,
l'un d'eux autorisé à muter le code pour une preuve par mutation. Un autre a vu le garde-fou
de stock disparaître sous ses yeux et a conclu à un défaut critique inexistant. **Une
vérification par mutation se fait seule et séquentiellement**, jamais pendant qu'un autre
agent lit le même fichier.

**Conséquence sur le journal : un agent en lecture seule ne consigne pas lui-même.** Le
journal est un fichier ; l'y écrire serait une modification, donc une infraction à la règle
ci-dessus. Il **remet son entrée au coordinateur sous la forme d'une ligne de commande prête
à exécuter** — un `npm run journal -- add …` complet, dans son rapport — et c'est le
coordinateur qui l'inscrit. La règle « toute intervention se consigne » (§ 9) tient donc
toujours : ce qui change, c'est la main qui écrit, pas l'obligation.

## 9. Journal des agents

Toute intervention d'un agent se consigne dans `docs/journal/entries.jsonl`, via l'outil
`tools/agent-journal/`. **Qui écrit dépend du rôle** : le développeur et le coordinateur
consignent eux-mêmes ; l'auditeur et le testeur UX/UI travaillent en lecture seule (§ 8) et
**remettent leur entrée au coordinateur en ligne de commande prête à exécuter**, sans la
lancer.

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
