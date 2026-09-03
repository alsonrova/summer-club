# Table de correspondance du renommage

**Chantier exécuté les 2026-09-03 et 2026-09-04** (journal `docs/journal/entries.jsonl`,
tâche `renommage` : 7 étapes puis audit final puis une passe de correctifs, verdict
`approved`). Ce document reste la **référence de ce qui a été appliqué** — table de
correspondance, points de vigilance et ordre d'exécution suivi — pas une liste de travail en
attente. La preuve que l'état courant du code correspond bien à cette table n'est pas un
chiffre figé ici, mais deux commandes à relancer : la commande de détection de
`docs/CONVENTIONS.md` § 1 (fichiers non conformes) et les greps de vérification finale du
§ 7 ci-dessous — les deux ne renvoient plus rien au moment d'écrire cette note.

**Ce document est la référence de l'agent qui a mené le renommage des identifiants français
vers l'anglais.** Il existe pour que ce travail ait été **mécanique et vérifiable** : chaque
nom source y a son nom cible, chaque piège y est nommé, et l'ordre d'exécution est donné.

La règle qui le gouverne est `docs/CONVENTIONS.md` § 1. Ce document ne la rediscute pas : il
l'applique. En cas de contradiction entre les deux, **c'est `CONVENTIONS.md` qui l'emporte**
et cette table qui est à corriger.

## Comment lire ce document

- **Les mesures sont datées du 2026-08-30.** Pour la tête exacte : `git log -1`. Chaque
  section indique la commande qui régénère sa liste — relancez-la, ne recopiez pas le
  chiffre.
- **Les ambiguïtés sont signalées, pas tranchées en silence.** Chaque ligne marquée ⚠ propose
  un terme et dit ce qui est discutable. Le propriétaire arbitre ; à défaut, la proposition
  s'applique et l'arbitrage se consigne au journal.
- **Le vocabulaire visé est celui du commerce électronique standard** (`OrderStatus`,
  `pending_payment`, `subtotal`, `sku`), pas une traduction mot à mot du français.

---

## 1. Les sept énumérations et toutes leurs valeurs

Source : `prisma/schema.prisma`. Les sept types existent aussi dans la base avec exactement
ces valeurs — vérifié le 2026-08-30 par `\dT+ public.*` sous `psql`.

### 1.1 Les cas déjà anglais, à traiter explicitement

Trois cas ne demandent **aucune** traduction de valeur. Les renommer par symétrie serait une
régression : on casserait des données pour rien.

| Type | Valeurs déjà conformes | Ce qui bouge quand même |
| --- | --- | --- |
| `TypePromo` | `percent`, `fixed` — **les deux** | le **nom du type** seulement |
| `Canal` | `orange_money`, `whatsapp` — noms propres, ne se traduisent pas | le nom du type, et la seule valeur française (`livraison`) |
| `Role` | `admin` — identique dans les deux langues | le nom du type est déjà conforme ; seule `membre` bouge |

`TypePromo` est le seul des sept dont *toutes* les valeurs sont déjà anglaises. C'est la
trace de la passe qui a fait glisser la frontière : elle a tranché en anglais ici et en
français partout ailleurs.

### 1.2 `Role` → `Role` *(nom déjà conforme)*

| Valeur actuelle | Valeur cible |
| --- | --- |
| `admin` | `admin` *(inchangée)* |
| `membre` | `member` |

Colonne portante : `User.role`. **Attention** : Better Auth est configuré avec
`adminRoles: ['admin']` et `defaultRole: 'membre'` (`src/server/auth.ts`) — la seconde valeur
est à changer dans la configuration en même temps que dans l'énumération, sinon la création
d'un compte écrit une valeur que le type refuse.

### 1.3 `Canal` → `Channel`

| Valeur actuelle | Valeur cible |
| --- | --- |
| `orange_money` | `orange_money` *(inchangée — nom propre)* |
| `whatsapp` | `whatsapp` *(inchangée — nom propre)* |
| `livraison` | `cash_on_delivery` |

**Tranché par le propriétaire.** `delivery` décrivait le mode d'acheminement ; ce que cette
valeur nomme est un mode de **paiement** — payer à la remise — aux côtés de deux moyens de
paiement/contact (`orange_money`, `whatsapp`). Le nom doit dire ce qu'il est :
`cash_on_delivery`.

Colonne portante : `Order.canal`.

### 1.4 `StatutCommande` → `OrderStatus`

Cible déjà inscrite dans `docs/CONVENTIONS.md` § 1 (`OrderStatus.pending_payment`).

| Valeur actuelle | Valeur cible |
| --- | --- |
| `en_attente_confirmation` | `pending_confirmation` |
| `en_attente_paiement` | `pending_payment` |
| `confirmee` | `confirmed` |
| `en_preparation` | `preparing` |
| `expediee` | `shipped` |
| `prete_retrait` | `ready_for_pickup` |
| `livree` | `delivered` |
| `annulee` | `cancelled` |
| `echec_paiement` | `payment_failed` |

**Tranché par le propriétaire.** `cancelled` (deux L, orthographe britannique), pas
`canceled` : c'est la forme dominante dans les schémas de commerce électronique. Appliqué
partout sans exception — schéma, `src/domain/order-status.ts` (table des transitions),
`src/admin/resources/orders.ts` (`LIBELLES_STATUT`, `LIBELLES_TRANSITION`), tests et fixtures.

Colonne portante : `Order.statut`, valeur par défaut `en_attente_confirmation`.

### 1.5 `PortePromo` → `PromotionScope`

| Valeur actuelle | Valeur cible |
| --- | --- |
| `produit` | `product` |
| `categorie` | `category` |
| `tout` | `all` |

⚠ `portee` est *la portée* d'une promotion : `PromotionScope` est le terme standard. Le nom
français actuel (`PortePromo`) est de toute façon une abréviation malheureuse.

Colonne portante : `Promotion.portee`.

### 1.6 `TypePromo` → `PromotionType`

| Valeur actuelle | Valeur cible |
| --- | --- |
| `percent` | `percent` *(inchangée)* |
| `fixed` | `fixed` *(inchangée)* |

**Seul le nom du type change.** Aucune valeur en base ne bouge, donc aucune donnée n'est
réécrite pour ce type — c'est le seul des sept dans ce cas. Colonne portante :
`Promotion.type`.

### 1.7 `SourceAvis` → `ReviewSource`

| Valeur actuelle | Valeur cible |
| --- | --- |
| `verifie` | `verified` |
| `importe` | `imported` |

Colonne portante : `Review.source`. Le libellé affiché reste « Achat vérifié » / « Importé »
(`LIBELLES_SOURCE_AVIS`).

### 1.8 `StatutAvis` → `ReviewStatus`

| Valeur actuelle | Valeur cible |
| --- | --- |
| `en_attente` | `pending` |
| `publie` | `published` |
| `rejete` | `rejected` |

Colonne portante : `Review.statut`, valeur par défaut `en_attente`. **C'est l'énumération la
plus exposée** : ses valeurs apparaissent en clair dans les URL de l'écran avis et dans deux
`page.goto` de bout en bout (§ 6).

---

## 2. Modèles et champs Prisma

**Les seize modèles sont déjà en anglais** — `User`, `Session`, `Account`, `Verification`,
`Category`, `Product`, `Variant`, `Media`, `Order`, `OrderItem`, `Payment`, `Promotion`,
`Review`, `DeliveryZone`, `Setting`, `AuditLog`. Rien à renommer de ce côté. Seuls des
**champs** sont français.

Régénérer la liste des champs :

```bash
grep -nE '^\s+[a-z][A-Za-z0-9]*\s' prisma/schema.prisma
```

| Modèle | Champ actuel | Champ cible | Note |
| --- | --- | --- | --- |
| `User` | `nom` | `name` | ⚠ voir § 6.5 — Better Auth mappe déjà `name` → `nom` |
| `User` | `tel` | `phone` | |
| `Category` | `nom` | `name` | |
| `Category` | `ordre` | `displayOrder` | |
| `Product` | `nom` | `name` | |
| `Product` | `prixBase` | `basePrice` | |
| `Product` | `prixAchat` | `costPrice` ⚠ | prix d'achat ; `purchasePrice` possible |
| `Product` | `actif` | `active` | |
| `Product` | `ordre` | `displayOrder` | |
| `Variant` | `libelle` | `label` | |
| `Variant` | `deltaPrix` | `priceDelta` | |
| `Variant` | `seuilAlerte` | `lowStockThreshold` ⚠ | `alertThreshold` plus littéral, moins parlant |
| `Media` | `chemin` | `path` | ⚠ voir § 6.4 — valeur stockée, pas seulement nom de colonne |
| `Order` | `tokenSuivi` | `trackingToken` | |
| `Order` | `canal` | `channel` | |
| `Order` | `statut` | `status` | |
| `Order` | `clientNom` | `customerName` | |
| `Order` | `tel` | `phone` | |
| `Order` | `adresse` | `address` | |
| `Order` | `sousTotal` | `subtotal` | |
| `Order` | `fraisLivraison` | `shippingFee` | |
| `Order` | `remise` | `discount` | |
| `OrderItem` | `nomFige` | `nameSnapshot` | tranché par le propriétaire : ces deux champs figent l'état au moment de la commande, « snapshot » le dit, « figé » se traduisait mal |
| `OrderItem` | `prixUnitaireFige` | `unitPriceSnapshot` | idem, par symétrie |
| `OrderItem` | `quantite` | `quantity` | |
| `Payment` | `montant` | `amount` | |
| `Payment` | `statut` | `status` | chaîne libre, pas une énumération |
| `Payment` | `refExterne` | `externalRef` | |
| `Payment` | `payloadBrut` | `rawPayload` | |
| `Promotion` | `nom` | `name` | |
| `Promotion` | `valeur` | `value` | |
| `Promotion` | `portee` | `scope` | |
| `Promotion` | `cibleId` | `targetId` | |
| `Promotion` | `debut` | `startsAt` ⚠ | `startAt`/`start` possibles ; `startsAt` lit mieux |
| `Promotion` | `fin` | `endsAt` ⚠ | idem |
| `Promotion` | `joursSemaine` | `weekdays` | masque de bits, 0 = lundi (voir `src/domain/pricing.ts`) |
| `Promotion` | `heureDebut` | `startHour` | |
| `Promotion` | `heureFin` | `endHour` | |
| `Promotion` | `membresSeulement` | `membersOnly` | |
| `Promotion` | `priorite` | `priority` | |
| `Promotion` | `actif` | `active` | |
| `Review` | `note` | `rating` | terme standard ; `score` moins usuel en commerce |
| `Review` | `texte` | `body` | tranché par le propriétaire ; `text` plus littéral, `body` évite la collision avec le type |
| `Review` | `auteur` | `author` | |
| `Review` | `statut` | `status` | |
| `Review` | `epingle` | `pinned` | |
| `DeliveryZone` | `nom` | `name` | |
| `DeliveryZone` | `tarif` | `fee` | cohérent avec `Order.shippingFee` |
| `DeliveryZone` | `delai` | `leadTime` | tranché par le propriétaire ; chaîne libre (« 2-3 jours ») |
| `DeliveryZone` | `actif` | `active` | |
| `DeliveryZone` | `ordre` | `displayOrder` | |
| `Setting` | `cle` | `key` | clé primaire |
| `Setting` | `valeur` | `value` | |
| `AuditLog` | `acteur` | `actor` | |
| `AuditLog` | `entite` | `entity` | ⚠ voir § 6.3 — les **valeurs** de cette colonne sont mixtes |
| `AuditLog` | `entiteId` | `entityId` | |
| `AuditLog` | `avant` | `before` | ⚠ voir § 6.2 — colonne `Json`, contenu non migré |
| `AuditLog` | `apres` | `after` | ⚠ idem |

**Tranché par le propriétaire : `ordre` → `displayOrder` (trois modèles — `Product`,
`Category`, `DeliveryZone`).** `position` aurait prêté à confusion avec le champ
`Media.position`, qui existe déjà et désigne autre chose (le rang d'une photo dans la galerie
d'un produit, pas l'ordre d'affichage d'une fiche produit, d'une catégorie ou d'une zone) :
même racine sémantique, portée différente. Vérifié : aucun des trois modèles ne porte déjà de
champ `displayOrder` ni `position` — pas de collision.

**Champs déjà conformes, à ne pas toucher** : `id`, `slug`, `email`, `emailVerified`,
`image`, `description`, `metaTitle`, `metaDescription`, `sku`, `stock`, `reference`, `total`,
`provider`, `idempotencyKey`, `isPrimary`, `alt`, `position`, `createdAt`, `updatedAt`, et
tous les champs de `Session`/`Account`/`Verification` imposés par Better Auth.

---

## 3. Fonctions, types et composants — exportés (§ 3.1 à 3.5) et internes (§ 3.6)

Liste établie par commande, pas de mémoire :

```bash
grep -rhoE '^export (async function|function|const|type|class|interface) [A-Za-z0-9_]+' \
  src/ --include='*.ts' --include='*.tsx' \
| sed -E 's/^export (async function|function|const|type|class|interface) //' | sort -u
```

**Mesure du 2026-08-30 : 138 identifiants exportés, dont 20 déjà conformes et 118 à
renommer.** Les 20 conformes, à ne pas toucher : `AdminForm`, `AdminTable`,
`DelegatePrisma`, `ProductInput`, `PromotionRule`, `ResourceConfig`, `VariantInput`, `auth`,
`config`, `defineResource`, `formatAriary`, `orderSchema`, `ordersResource`, `prisma`,
`productSchema`, `productsResource`, `proxy`, `requireAdmin`, `variantSchema`,
`variantsResource`.

§ 3.1 à 3.4 couvrent ces 138 identifiants exportés, par répertoire. § 3.6 fait de même pour
les 42 identifiants internes non exportés (`CONVENTIONS.md` § 1) — même principe, table
séparée parce que la commande qui les recense est différente.

### 3.1 `src/domain/`

| Actuel | Cible |
| --- | --- |
| `STATUTS` | `ORDER_STATUSES` |
| `Statut` | `OrderStatus` |
| `STOCK_ENGAGE` | `STOCK_COMMITTED` |
| `estStatut` | `isOrderStatus` |
| `transitionsDepuis` | `transitionsFrom` |
| `transitionAutorisee` | `transitionAllowed` |
| `effetSurStock` | `stockEffect` |
| `appliquerPourcentage` | `applyPercentage` |
| `resolvePrix` | `resolvePrice` |
| `PrixEffectif` | `EffectivePrice` |
| `LignePanier` | `CartLine` |
| `TotauxPanier` | `CartTotals` |
| `calculerTotaux` | `computeTotals` |

Valeurs de retour de `effetSurStock` : `'decrementer' | 'recrediter' | 'aucun'` →
`'decrement' | 'credit_back' | 'none'`. Ce sont des chaînes littérales internes, non
stockées : sûres à changer, mais elles apparaissent dans les tests.

### 3.2 `src/server/`

| Actuel | Cible |
| --- | --- |
| `CommandeError` | `OrderError` |
| `RuptureStockError` | `OutOfStockError` |
| `QuantiteInvalideError` | `InvalidQuantityError` |
| `PanierVideError` | `EmptyCartError` |
| `ZoneInvalideError` | `InvalidZoneError` |
| `ProduitIndisponibleError` | `ProductUnavailableError` |
| `ProduitIntrouvableError` | `ProductNotFoundError` |
| `VariantIntrouvableError` | `VariantNotFoundError` |
| `TransitionInterditeError` | `ForbiddenTransitionError` |
| `AvisError` | `ReviewError` |
| `AvisNonPublieError` | `ReviewNotPublishedError` |
| `EpinglageInvalideError` | `InvalidPinError` |
| `StatutAvisInvalideError` | `InvalidReviewStatusError` |
| `ErreurImageIllisible` | `UnreadableImageError` |
| `CommandeInput` | `OrderInput` |
| `CommandeCreee` | `CreatedOrder` |
| `creerCommande` | `createOrder` |
| `appliquerStatut` | `applyStatus` |
| `cheminsARevalider` | `pathsToRevalidate` |
| `enregistrerAudit` | `recordAudit` |
| `ClientAudit` | `AuditClient` |
| `traiterImage` | `processImage` |
| `effacerFichiersMedia` | `deleteMediaFiles` |
| `validerFichierMedia` | `validateMediaFile` |
| `TYPES_IMAGE_ACCEPTES` | `ACCEPTED_IMAGE_TYPES` |
| `TAILLE_MAX_MEDIA_OCTETS` | `MAX_MEDIA_BYTES` |
| `estViolationUnicite` | `isUniqueViolation` |

**`CommandeError` porte `this.name = new.target.name`** : le nom de classe *est* la valeur
transportée. Renommer la classe change ce que voit un `catch` qui comparerait `err.name` —
vérifier qu'aucun ne le fait avant de renommer (aujourd'hui les `catch` utilisent
`instanceof`, ce qui est sûr).

**Correction du 2026-08-30 :** cette section plaçait `epinglerAvis`, `modererAvis` et
`importerTemoignage` ici, sous `src/server/`. Vérification faite contre le code réel, les
trois vivent dans `src/app/admin/avis/actions.ts`, à côté de leurs variantes
`…DepuisFormulaire` — elles sont donc en § 3.4, pas ici. L'erreur n'était pas cosmétique :
l'ordre d'exécution (§ 7) traite `src/server/` à l'étape 2 et `src/app/` à l'étape 4 ; filées
sous § 3.2, ces trois fonctions n'auraient été renommées à aucune des deux — l'étape 2 les
aurait cherchées en vain, l'étape 4 ne les aurait pas cherchées du tout.

### 3.3 `src/admin/`

| Actuel | Cible |
| --- | --- |
| `ChampAdmin` | `AdminField` |
| `ErreursValidation` | `ValidationErrors` |
| `ResultatValidation` | `ValidationResult` |
| `validerFormData` | `validateFormData` |
| `formDataVersObjet` | `formDataToObject` |
| `creerRessource` | `createResource` |
| `modifierRessource` | `updateResource` |
| `supprimerRessource` | `deleteResource` |
| `versCSV` | `toCSV` |
| `CANAUX` | `CHANNELS` |
| `estCanal` | `isChannel` |
| `LIBELLES_STATUT` | `STATUS_LABELS` |
| `LIBELLES_TRANSITION` | `TRANSITION_LABELS` |
| `LIBELLES_CANAL` | `CHANNEL_LABELS` |
| `libelleStatut` | `statusLabel` |
| `libelleCanal` | `channelLabel` |
| `OrderListeInput` | `OrderListInput` |

Options de `defineResource` : `champsSysteme` → `systemFields`, `libelles` → `labels`,
`CHAMPS_SYSTEME_PAR_DEFAUT` → `DEFAULT_SYSTEM_FIELDS`. **Les valeurs** de `libelles` restent
en français (ce sont des libellés d'interface) ; seule la clé de l'option change.

`resource.name` : `'produits'` → `'products'`, `'commandes'` → `'orders'`, `'declinaisons'` →
`'variants'`. ⚠ **Ces chaînes sont écrites en base** dans `AuditLog.entite` — voir § 6.3.

### 3.4 `src/app/` et `src/components/`

| Actuel | Cible |
| --- | --- |
| `PRODUITS_PAR_PAGE` | `PRODUCTS_PER_PAGE` |
| `COMMANDES_PAR_PAGE` | `ORDERS_PER_PAGE` |
| `AVIS_PAR_PAGE` | `REVIEWS_PER_PAGE` |
| `FiltresProduits` / `FiltresCommandes` / `FiltresAvis` | `ProductFilters` / `OrderFilters` / `ReviewFilters` |
| `LigneProduitListe` / `LigneCommandeListe` / `LigneAvisListe` | `ProductListRow` / `OrderListRow` / `ReviewListRow` |
| `DelegateListeProduits` / `DelegateListeCommandes` / `DelegateListeAvis` | `ProductListDelegate` / `OrderListDelegate` / `ReviewListDelegate` |
| `listerProduitsPagines` / `listerCommandesPaginees` / `listerAvisPagines` | `listProductsPaginated` / `listOrdersPaginated` / `listReviewsPaginated` |
| `Canal` *(alias de `query.ts`)* | `Channel` |
| `STATUTS_AVIS` | `REVIEW_STATUSES` |
| `STATUTS_MODERATION` | `MODERATION_STATUSES` |
| `StatutModeration` | `ModerationStatus` |
| `estStatutAvis` | `isReviewStatus` |
| `estStatutModeration` | `isModerationStatus` |
| `LIBELLES_STATUT_AVIS` | `REVIEW_STATUS_LABELS` |
| `LIBELLES_SOURCE_AVIS` | `REVIEW_SOURCE_LABELS` |
| `creerProduit` / `modifierProduit` | `createProduct` / `updateProduct` |
| `creerDeclinaison` | `createVariant` |
| `ajusterStock` | `adjustStock` |
| `televerserMedia` | `uploadMedia` |
| `supprimerMedia` | `deleteMedia` |
| `reordonnerMedia` | `reorderMedia` |
| `modifierAltMedia` | `updateMediaAlt` |
| `definirPhotoPrincipale` | `setPrimaryPhoto` |
| `changerStatut` | `changeStatus` |
| `changerStatutDepuisFormulaire` | `changeStatusFromForm` |
| `epinglerAvis` | `pinReview` |
| `epinglerAvisDepuisFormulaire` | `pinReviewFromForm` |
| `modererAvis` | `moderateReview` |
| `modererAvisDepuisFormulaire` | `moderateReviewFromForm` |
| `importerTemoignage` | `importTestimonial` |
| `importerTemoignageDepuisFormulaire` | `importTestimonialFromForm` |
| `EtatActionSimple` / `etatActionSimpleInitial` | `SimpleActionState` / `initialSimpleActionState` |
| `EtatActionAvis` / `etatActionAvisInitial` | `ReviewActionState` / `initialReviewActionState` |
| `EtatChangementStatut` / `etatChangementStatutInitial` | `StatusChangeState` / `initialStatusChangeState` |
| `EtatFormulaireProduit` / `etatFormulaireProduitInitial` | `ProductFormState` / `initialProductFormState` |
| `EtatFormulaireDeclinaison` / `etatFormulaireDeclinaisonInitial` | `VariantFormState` / `initialVariantFormState` |
| `EtatFormulaireTemoignage` / `etatFormulaireTemoignageInitial` | `TestimonialFormState` / `initialTestimonialFormState` |
| `FormulaireProduit` | `ProductForm` |
| `FormulaireDeclinaison` | `VariantForm` |
| `FormulaireStock` | `StockForm` |
| `FormulaireMedia` | `MediaForm` |
| `FormulaireTemoignage` | `TestimonialForm` |
| `MediaCarte` | `MediaCard` |
| `BoutonsStatut` | `StatusButtons` |
| `ActionsAvis` | `ReviewActions` |
| `BoutonDeconnexion` | `SignOutButton` |

### 3.5 `tools/agent-journal/`

**Rien à renommer** : `JournalError`, `appendEntry`, `parseJournal`, `renderMarkdown`,
`normalizeEntry`, `filterEntries`, `readEntries`, `serializeEntry`, `writeSummary`,
`repoRoot`, `countLabel`, `defaultJournalPath`, `defaultSummaryPath`, `SCHEMA_VERSION`,
`ROLES`, `SEVERITIES`, `SOURCES`, `VERDICTS` sont déjà conformes. Vérifié par la même
commande, adaptée à `tools/`.

### 3.6 Identifiants internes non exportés (`src/`)

**`CONVENTIONS.md` § 1 le dit maintenant explicitement : la règle ne s'arrête pas aux
identifiants exportés.** Une constante de module, une fonction ou un type de premier niveau
qui n'est jamais exporté reste aussi français, et aussi illisible pour un lecteur anglophone,
qu'un identifiant exporté. Cette section les recense et leur donne un nom cible, exactement
comme le § 3 précédent le fait pour les 138 identifiants exportés. Les **variables locales à
l'intérieur d'une fonction** n'y figurent pas : trop nombreuses pour une table, elles se
renomment au fil de la lecture de chaque fichier concerné (`CONVENTIONS.md` § 1).

Commande — déclarations de premier niveau qui ne commencent pas par `export`, puis filtre sur
le vocabulaire français réellement rencontré ici :

```bash
grep -rhoE '^(async function|function|const|type|class|interface) [A-Za-z0-9_]+' \
  src/ --include='*.ts' --include='*.tsx' \
| sed -E 's/^(async function|function|const|type|class|interface) //' | sort -u \
| grep -iE 'avis|bouton|champ|categorie|dossier|entier|erreur|fuseau|largeur|ligne|nombre|canal|statut|quantite|interne|analyser|capitalis|construire|heure|echapp|encoder|variante|formater|valeur|omettre|systeme|prix|apres|revalider|courant|rotation|trace|temoignage|texte|liste|soumis|filtre|actif|defaut|^est[A-Z]|^vers[A-Z]'
```

*(Même principe que le filtre de noms de fichiers de `CONVENTIONS.md` § 1 : le vocabulaire
est celui réellement rencontré dans ce dépôt, pas une liste exhaustive de mots français ; un
identifiant interne français nouveau s'y ajoute.)*

**Résultat de cette commande le 2026-08-30 : 42 identifiants.** Mesure datée, pas un état
permanent : relancez-la. Vérifié un par un contre le code réel (fichier, signature, usage) —
sept identifiants au vocabulaire français ou ambigu en ont délibérément été écartés parce
qu'ils sont déjà conformes : `ActionMedia`, `ActionTransition`, `Media` (type local de
`media-carte.tsx`, distinct du modèle Prisma), `NBSP`, `SchemaAdmin`, `TRANSITIONS`,
`authClient`, `getSessionAdmin`, `globalForPrisma` — l'anglais et le français y partagent une
orthographe identique ou proche, ce ne sont pas des mots français.

| Actuel | Cible | Fichier(s) |
| --- | --- | --- |
| `FUSEAU` | `TIMEZONE` | `src/domain/pricing.ts` |
| `heureLocale` | `localTime` | `src/domain/pricing.ts` |
| `estApplicable` | `isApplicable` | `src/domain/pricing.ts` |
| `prixApres` | `priceAfter` | `src/domain/pricing.ts` |
| `DOSSIER` | `UPLOAD_DIR` | `src/server/media.ts` |
| `LARGEURS` | `WIDTHS` | `src/server/media.ts` |
| `encoderVariante` | `encodeVariant` | `src/server/media.ts` |
| `QUANTITE_MAX` | `MAX_QUANTITY` | `src/server/orders.ts` |
| `secretCourantDeLaRotation` | `currentRotationSecret` | `src/server/auth.ts` |
| `CHAMPS_SYSTEME_PAR_DEFAUT` | `DEFAULT_SYSTEM_FIELDS` | `src/admin/resource.ts` |
| `ZodDefInterne` | `InternalZodDef` | `src/admin/resource.ts` |
| `capitaliser` | `capitalize` | `src/admin/resource.ts` |
| `analyserChamp` | `analyzeField` | `src/admin/resource.ts` |
| `ChampSaisie` | `InputField` | `src/admin/engine/form.tsx` |
| `valeurTexte` | `textValue` | `src/admin/engine/form.tsx` |
| `construireUrl` | `buildUrl` | `src/admin/engine/table.tsx` |
| `formaterValeur` | `formatValue` | `src/admin/engine/table.tsx` |
| `omettreChampsSysteme` | `omitSystemFields` | `src/admin/engine/actions.ts` |
| `NOMBRE_BIEN_FORME` | `WELL_FORMED_NUMBER` | `src/admin/engine/csv.ts` |
| `echapper` | `escapeCsvValue` | `src/admin/engine/csv.ts` |
| `ENTIER_POSTGRES_MAX` | `POSTGRES_INT_MAX` | `src/admin/resources/products.ts`, `src/admin/resources/variants.ts`, `src/app/admin/produits/actions.ts` — trois déclarations locales indépendantes, même nom |
| `ENTIER_POSTGRES_MIN` | `POSTGRES_INT_MIN` | `src/admin/resources/variants.ts` |
| `ActionAvis` | `ReviewAction` | `src/app/admin/avis/actions-avis.tsx` |
| `BoutonAction` | `ActionButton` | `src/app/admin/avis/actions-avis.tsx` |
| `BoutonTransition` | `TransitionButton` | `src/app/admin/commandes/[id]/boutons-statut.tsx` |
| `Erreurs` | `FieldErrors` | `src/app/admin/avis/formulaire-temoignage.tsx` |
| `revaliderAvis` | `revalidateReviewPaths` | `src/app/admin/avis/actions.ts` |
| `temoignageSchema` | `testimonialSchema` | `src/app/admin/avis/actions.ts` |
| `valeursSoumises` | `submittedValues` | `src/app/admin/avis/actions.ts` |
| `urlListe` | `listUrl` | `src/app/admin/avis/page.tsx` |
| `versStatutAvis` | `toReviewStatus` | `src/app/admin/avis/page.tsx` |
| `versPageValide` | `toValidPage` | `src/app/admin/avis/page.tsx`, `src/app/admin/commandes/page.tsx`, `src/app/admin/produits/page.tsx` — trois déclarations locales indépendantes |
| `Categorie` | `CategoryOption` | `src/app/admin/produits/formulaire-produit.tsx` — ⚠ pas `Category` : collision de nom avec le modèle Prisma `Category`, alors que cette forme locale n'a que deux champs |
| `ChampErreurs` | `FieldErrors` | `src/app/admin/produits/formulaire-produit.tsx`, `src/app/admin/produits/[id]/formulaire-declinaison.tsx` |
| `texteInitial` | `initialText` | `src/app/admin/produits/formulaire-produit.tsx`, `src/app/admin/produits/[id]/formulaire-declinaison.tsx` |
| `versFiltreActif` | `toActiveFilter` | `src/app/admin/produits/page.tsx` |
| `Ligne` | `DetailRow` | `src/app/admin/commandes/[id]/page.tsx` |
| `dateHeure` | `formatDateTime` | `src/app/admin/commandes/[id]/page.tsx` |
| `statutDeTrace` | `statusFromTrace` | `src/app/admin/commandes/[id]/page.tsx` |
| `OPTIONS_CANAL` | `CHANNEL_OPTIONS` | `src/app/admin/commandes/page.tsx` |
| `OPTIONS_STATUT` | `STATUS_OPTIONS` | `src/app/admin/commandes/page.tsx` |
| `texteCourt` | `truncateText` | `src/app/admin/commandes/page.tsx` |

Vérifié : aucun de ces noms cibles n'entre en collision avec un identifiant déjà présent dans
son propre fichier — sauf le cas `Categorie` ci-dessus, déjà tranché en `CategoryOption`.

**Où elles se renomment dans l'ordre d'exécution (§ 7) :** chacune au même moment que le
reste de son fichier — les quatre de `src/domain/` à l'étape 1, les cinq de `src/server/` à
l'étape 2, les treize déclarations de `src/admin/` à l'étape 3, les vingt de `src/app/` à
l'étape 4. Rien de nouveau à ajouter à l'ordre d'exécution pour elles : elles vivent dans les
mêmes fichiers que les identifiants exportés déjà couverts à ces étapes. Cas particulier :
`ENTIER_POSTGRES_MAX` est déclarée trois fois sous des noms identiques mais dans des fichiers
indépendants — deux comptent pour `src/admin/` (étape 3), la troisième
(`src/app/admin/produits/actions.ts`) compte pour `src/app/` (étape 4) : les 13 et les 20
ci-dessus l'incluent chacun une fois, pour sa déclaration respective.

### 3.7 Propriétés de types et clés de paramètres *(complément du 2026-09-03)*

**Trou découvert à l'étape 1 :** les tables § 3.1 à 3.6 recensent des déclarations de premier
niveau — jamais les **propriétés** d'un type ou les clés d'un paramètre déstructuré. Or une
propriété est un identifiant comme un autre, et la règle du propriétaire (2026-09-03,
`CONVENTIONS.md` § 1) ne souffre aucune exception : un identifiant français rend le code
invalide.

**Principe :** chaque étape renomme les propriétés des types que sa couche déclare, en
puisant le vocabulaire dans la table § 2 (les colonnes Prisma) quand la propriété en est le
miroir. L'exécutant d'une étape **complète la table ci-dessous pour sa couche dans son
commit** — ce document reste la trace ; un doute se marque ⚠ et se tranche en revue.

Couche `src/domain/` (arbitrée par le coordinateur, consignée au journal) :

| Type ou paramètre | Actuel | Cible |
| --- | --- | --- |
| `EffectivePrice` | `prixInitial` / `prixFinal` | `initialPrice` / `finalPrice` — aligné sur `StorefrontProduct` (déjà conforme) |
| `CartLine` | `prixUnitaire` / `quantite` | `unitPrice` / `quantity` |
| `CartTotals` | `sousTotal` / `fraisLivraison` / `remise` | `subtotal` / `shippingFee` / `discount` — miroirs des colonnes `Order` (§ 2) : le **type** change dès l'étape 1-bis, les **colonnes** attendent l'étape 6 |
| `resolvePrice` (clés du paramètre) | `prixBase` / `maintenant` / `estMembre` | `basePrice` / `now` / `isMember` |

Couche `src/server/` (étape 2) :

| Type ou paramètre | Actuel | Cible |
| --- | --- | --- |
| `OrderInput` (`CommandeInput`) | `lignes` / `lignes[].quantite` / `estMembre` | `lines` / `lines[].quantity` / `isMember` |
| `OrderInput.client` | `nom` / `tel` / `adresse` | `customerName` / `phone` / `address` — vocabulaire de la colonne `Order` (§ 2) |
| `OrderInput` | `canal` | `channel` ⚠ le document de cadrage range `canal` du côté des clés qui « restent françaises jusqu'à l'étape 6 » dans son exemple de frontière Prisma (`{ sousTotal, clientNom, statut, canal }`), mais cet exemple décrit l'objet `data` écrit dans Prisma, pas le type `OrderInput` lui-même. Par symétrie avec `CartTotals` (§ 1-bis, ci-dessus : le type change dès son étape, la colonne Prisma attend l'étape 6), et parce que le champ est réécrit dans ce commit, `canal` devient `channel` sur `OrderInput` — seule sa valeur (`'orange_money' \| 'whatsapp' \| 'livraison'`) reste inchangée. Au point d'écriture Prisma (`tx.order.create({ data: { canal: input.channel, … } })`), la clé `canal:` reste française, conformément à la distinction critique |
| `CreatedOrder` (`CommandeCreee`) | `tokenSuivi` | `trackingToken` — miroir de `Order.tokenSuivi` (§ 2), type propre à cette couche, pas un objet passé tel quel à Prisma |
| `recordAudit` (`enregistrerAudit`, args) | `acteur` / `entite` / `entiteId` / `avant` / `apres` | `actor` / `entity` / `entityId` / `before` / `after`. À la frontière Prisma, à l'intérieur de `recordAudit`, les clés de `client.auditLog.create({ data: { … } })` restent `acteur`/`entite`/`entiteId`/`avant`/`apres` (colonnes `AuditLog`, § 2, étape 6) — seules les valeurs viennent des champs renommés (`args.actor`, …) |
| `ForbiddenTransitionError` (`TransitionInterditeError`, propriétés publiques) | `de` / `vers` | `from` / `to` — aligné sur `transitionAllowed(from, to)` (`src/domain/order-status.ts`, déjà ainsi depuis l'étape 1) |
| `ReviewNotPublishedError` (`AvisNonPublieError`, propriété publique) | `statut` | `status` |
| `InvalidReviewStatusError` / `InvalidPinError` (`StatutAvisInvalideError` / `EpinglageInvalideError`, propriété publique) | `valeur` | `value` |
| `processImage` (`traiterImage`, forme de retour) | `largeurs` | `widths` — le second champ du retour, `chemin`, **reste français** : il est réinjecté tel quel dans `prisma.media.create({ data: { …, chemin } })` par ses appelants (`src/app/admin/produits/actions.ts`), donc contraint par la frontière Prisma (`Media.chemin`, § 2, étape 6), au même titre que le paramètre `mediaPath` de `deleteMediaFiles` |

Couche `src/admin/` (étape 3) :

| Type ou paramètre | Actuel | Cible |
| --- | --- | --- |
| `AdminField` (`ChampAdmin`) | `requis` | `required` |
| `ValidationResult` (`ResultatValidation`) | `succes` / `donnees` / `erreurs` | `success` / `data` / `errors` |
| `AdminTable` (clés du paramètre déstructuré) | `lignes` / `cheminBase` / `filtres` / `formatColonnes` / `optionsFiltres` / `lien` | `rows` / `basePath` / `filters` / `columnFormatters` / `filterOptions` / `link` — non couvertes par § 3.3/§ 3.6 (le nom `AdminTable` était déjà conforme, seules ses clés de paramètre déstructuré ne l'étaient pas) ; découvertes en exécutant l'étape 3, dans le même esprit que les clés de `resolvePrice` (§ 3.7, couche `src/domain/`). Ses deux usages (`src/app/admin/commandes/page.tsx`, `src/app/admin/produits/page.tsx`) suivent dans le même commit |
| `AdminTable.link` (`lien`) | `colonne` / `vers` | `column` / `to` |
| `AdminTable.filterOptions` (`optionsFiltres`, éléments) | `valeur` / `libelle` | `value` / `label` |
| `AdminForm` (clés du paramètre déstructuré) | `valeursInitiales` / `erreurs` / `libelleSoumettre` | `initialValues` / `errors` / `submitLabel` — même découverte ; `AdminForm` n'est pour l'instant invoqué nulle part dans `src/app/`, donc aucun consommateur à aligner dans ce commit |

Couche `src/app/` et `src/components/` (étape 4) :

| Type ou paramètre | Actuel | Cible |
| --- | --- | --- |
| `TestimonialFormState` / `ReviewActionState` (`EtatFormulaireTemoignage` / `EtatActionAvis`) | `succes` / `erreurs` / `valeursInitiales` / `erreur` | `success` / `errors` / `initialValues` / `error` |
| `StatusChangeState` (`EtatChangementStatut`) | `erreur` | `error` |
| `ProductFormState` / `VariantFormState` / `SimpleActionState` (`EtatFormulaireProduit` / `EtatFormulaireDeclinaison` / `EtatActionSimple`) | `succes` / `erreurs` / `valeursInitiales` / `erreur` | `success` / `errors` / `initialValues` / `error` |
| `ReviewFilters` (`FiltresAvis`, paramètre de `listReviewsPaginated`) | `statut` / `epingle` | `status` / `pinned` |
| `OrderFilters` (`FiltresCommandes`, paramètre de `listOrdersPaginated`) | `statut` / `canal` | `status` / `channel` |
| `ProductFilters` (`FiltresProduits`, paramètre de `listProductsPaginated`) | `actif` | `active` — `categoryId` était déjà conforme |
| `listReviewsPaginated` / `listOrdersPaginated` / `listProductsPaginated` (forme de retour) | `lignes` | `rows` — miroir du prop déjà anglais `AdminTable.rows` (§ 3.7, couche `src/admin/`, ci-dessus) |
| `ReviewListRow` (`LigneAvisListe`) | `auteur` / `note` / `texte` / `statut` / `epingle` / `produit` | `author` / `rating` / `body` / `status` / `pinned` / `product` — libre de toute contrainte, contrairement aux deux lignes suivantes : l'écran avis ne passe jamais cette ligne à `<AdminTable>`, il construit son propre `<table>` |
| ⚠ `OrderListRow` (`LigneCommandeListe`) | `clientNom` / `tel` / `canal` / `statut` | **inchangés à l'étape 4 ; renommés à l'étape 6** (`customerName` / `phone` / `channel` / `status`) |
| ⚠ `ProductListRow` (`LigneProduitListe`) | `nom` / `prixBase` / `prixAchat` / `actif` / `ordre` | **inchangés à l'étape 4 ; renommés à l'étape 6** (`name` / `basePrice` / `costPrice` / `active` / `displayOrder`) |

**Sur ces deux derniers ⚠ : à l'étape 4, seul le NOM du type changeait, pas ses champs.** `OrderListRow`/`ProductListRow` sont passées telles quelles en prop `rows` à `<AdminTable resource={ordersResource|productsResource} ...>` (`src/admin/engine/table.tsx`), dont le paramètre générique `T` est lié par inférence à `OrderListInput`/`ProductInput` (`src/admin/resources/{orders,products}.ts`, dérivés par `z.infer` des schémas `orderSchema`/`productSchema` — miroirs des colonnes Prisma, § 2, pas encore renommées alors). Renommer ces champs à l'étape 4 aurait rompu l'assignabilité structurelle à la compilation (`tsc` refuse alors `rows={rows}` : propriétés requises manquantes). C'était la même frontière que `Media.chemin`, documentée pour `src/server/` ci-dessus — une propriété qui semble appartenir à cette couche mais qui est en réalité contrainte par un point de consommation encore français. Vérifié en compilant les deux sens (renommé → `tsc` échoue ; inchangé → `tsc` passe) avant de trancher.

**Levé à l'étape 6.** La contrainte disparaissait avec la cause : dès que `orderSchema`/`productSchema` ont suivi les colonnes renommées, les deux lignes ont dû suivre à leur tour, dans le même commit. Il ne restait rien à arbitrer — le vocabulaire est celui de la table § 2.

| Type ou paramètre | Actuel | Cible |
| --- | --- | --- |
| `ProductForm` (`FormulaireProduit`, props) | `etatInitial` / `libelleSoumettre` | `initialState` / `submitLabel` — props propres à ce composant hand-écrit (distinct d'`AdminForm`) |
| `VariantForm` (`FormulaireDeclinaison`, props) | `prixBase` | `basePrice` — simple prop d'affichage, sans lien avec `AdminTable` |
| `StockForm` (`FormulaireStock`, props) | `stockActuel` / `seuilAlerte` | `currentStock` / `lowStockThreshold` — miroir du vocabulaire `Variant.seuilAlerte` → `lowStockThreshold` (§ 2) |
| `MediaCard` (`MediaCarte`, props) | `actionReordonner` / `actionAlt` / `actionPrincipale` / `actionSupprimer` | `reorderAction` / `altAction` / `primaryAction` / `deleteAction` |
| `ReviewActions` (`ActionsAvis`, props) | `publier` / `rejeter` / `basculerEpingle` / `statut` / `epingle` | `publish` / `reject` / `togglePinned` / `status` / `pinned` |
| `StatusButtons` (`BoutonsStatut`, props et éléments de `transitions`) | `vers` / `libelle` | `to` / `label` |
| `changeStatus` / `changeStatusFromForm` (`changerStatut`, paramètre) | `vers` | `to` — aligné sur `transitionAllowed(from, to)` (`src/domain/order-status.ts`), déjà ainsi depuis l'étape 1 |

**Trou découvert à l'étape 4, même famille que celui de l'étape 1 (§ 3.6) :** la commande d'audit du § 3 (`grep -rhoE '^export (async function|function|const|type|class|interface) …'`) ne capture pas `export default async function NomPage(...)` — le mot `default` casse le motif `^export (async function|…)`. Six pages d'administration et deux pages publiques portaient donc un nom de fonction français jamais recensé dans aucune table : `AvisPage`, `CommandesPage`, `FicheCommandePage`, `NouveauProduitPage`, `ProduitsPage`, `FicheProduitPage`, `AccesRefusePage`, `ConnexionPage`. Aucune n'est importée par son nom ailleurs (un export par défaut de `page.tsx` n'est référencé que par Next.js, via le chemin de fichier) : renommage sans risque, dans le même commit.

| Actuel | Cible | Fichier |
| --- | --- | --- |
| `AvisPage` | `ReviewsPage` | `src/app/admin/avis/page.tsx` |
| `CommandesPage` | `OrdersPage` | `src/app/admin/commandes/page.tsx` |
| `FicheCommandePage` | `OrderDetailPage` | `src/app/admin/commandes/[id]/page.tsx` |
| `NouveauProduitPage` | `NewProductPage` | `src/app/admin/produits/nouveau/page.tsx` |
| `ProduitsPage` | `ProductsPage` | `src/app/admin/produits/page.tsx` |
| `FicheProduitPage` | `ProductDetailPage` | `src/app/admin/produits/[id]/page.tsx` |
| `AccesRefusePage` | `AccessDeniedPage` | `src/app/acces-refuse/page.tsx` |
| `ConnexionPage` | `SignInPage` | `src/app/connexion/page.tsx` |

Couche « schéma, base et consommateurs » (étape 6) — les propriétés qu'aucune étape
précédente ne pouvait toucher, parce qu'elles étaient contraintes par la frontière Prisma :

| Type ou paramètre | Actuel | Cible |
| --- | --- | --- |
| `PromotionRule` (`src/domain/types.ts`) | `valeur` / `portee` / `cibleId` / `debut` / `fin` / `joursSemaine` / `heureDebut` / `heureFin` / `membresSeulement` / `priorite` / `actif` | `value` / `scope` / `targetId` / `startsAt` / `endsAt` / `weekdays` / `startHour` / `endHour` / `membersOnly` / `priority` / `active` — miroir exact des colonnes `Promotion` (§ 2) ; le type est lu directement depuis `promotion.findMany()` par un `as PromotionRule[]` (`src/server/orders.ts`), il ne pouvait donc pas devancer la colonne |
| `processImage` (forme de retour) | `chemin` | `path` — la contrainte notée en § 3.7 (couche `src/server/`) tombe avec le renommage de `Media.chemin` : ses appelants réinjectent la valeur dans `prisma.media.create({ data: { path } })` |
| `orderSchema` / `productSchema` / `variantSchema` (clés) | miroirs des colonnes | idem § 2 — et, par ricochet, les `columns`/`filters`/`labels` de chaque ressource, les `name=` des formulaires hand-écrits et les clés de `state.errors` qui en dérivent |
| `resource.name` | `'produits'` / `'commandes'` / `'declinaisons'` | `'products'` / `'orders'` / `'variants'` — écrites en base dans `AuditLog.entity`, d'où l'`UPDATE` de § 6.3 |
| `DetailRow` (`src/app/admin/commandes/[id]/page.tsx`, prop) | `libelle` | `label` — trou du même ordre que ceux des étapes 1 et 4 : un composant local dont la prop n'a jamais été recensée |
| `TestimonialForm` (champs de formulaire) | `auteur` / `note` / `texte` | `author` / `rating` / `body` — les `name=` suivent les clés de `testimonialSchema`, elles-mêmes miroirs des colonnes `Review` ; les libellés affichés (« Autrice », « Note », « Témoignage ») ne bougent pas |
| `MediaForm` (champ de formulaire) | `fichier` | `file` |

**Nouveauté d'interface introduite par cette étape : `AdminTable.filterParams`.** Les champs
sont passés à l'anglais, les adresses restent françaises (`CONVENTIONS.md` § 1) : sans
indirection, le `<select name={...}>` du filtre aurait émis `?status=`/`?canal=` alors que
les pages relisent `sp.statut`/`sp.canal`/`sp.actif`, et **le filtrage aurait cessé de
fonctionner en silence** — aucun test unitaire ne le couvre, et les deux `page.goto` de
§ 6.1 ne visent que l'écran avis. La prop mappe nom de champ → nom de paramètre d'URL, et
reste optionnelle : un filtre absent de l'objet porte son propre nom.

---

## 4. Fichiers à renommer

Critère et commande : `docs/CONVENTIONS.md` § 1, sous-section « Ce qui reste à renommer ».
**Mesure du 2026-08-30 : 27 fichiers.** Utilisez `git mv`, jamais un déplacement hors de git
— sans quoi l'historique du fichier est perdu.

| Actuel | Cible |
| --- | --- |
| `src/app/admin/avis/etats.ts` | `src/app/admin/avis/states.ts` |
| `src/app/admin/commandes/etats.ts` | `src/app/admin/commandes/states.ts` |
| `src/app/admin/produits/etats.ts` | `src/app/admin/produits/states.ts` |
| `src/app/admin/avis/actions-avis.tsx` | `src/app/admin/avis/review-actions.tsx` |
| `src/app/admin/avis/formulaire-temoignage.tsx` | `src/app/admin/avis/testimonial-form.tsx` |
| `src/app/admin/commandes/[id]/boutons-statut.tsx` | `src/app/admin/commandes/[id]/status-buttons.tsx` |
| `src/app/admin/produits/formulaire-produit.tsx` | `src/app/admin/produits/product-form.tsx` |
| `src/app/admin/produits/[id]/formulaire-declinaison.tsx` | `src/app/admin/produits/[id]/variant-form.tsx` |
| `src/app/admin/produits/[id]/formulaire-media.tsx` | `src/app/admin/produits/[id]/media-form.tsx` |
| `src/app/admin/produits/[id]/formulaire-stock.tsx` | `src/app/admin/produits/[id]/stock-form.tsx` |
| `src/app/admin/produits/[id]/media-carte.tsx` | `src/app/admin/produits/[id]/media-card.tsx` |
| `src/components/bouton-deconnexion.tsx` | `src/components/sign-out-button.tsx` |
| `src/server/prisma-erreurs.ts` | `src/server/prisma-errors.ts` |
| `tests/admin/avis-actions.test.ts` | `tests/admin/review-actions.test.ts` |
| `tests/admin/avis-query.test.ts` | `tests/admin/review-query.test.ts` |
| `tests/admin/champs-systeme.test.ts` | `tests/admin/system-fields.test.ts` |
| `tests/admin/commandes-actions.test.ts` | `tests/admin/order-actions.test.ts` |
| `tests/admin/commandes-query.test.ts` | `tests/admin/order-query.test.ts` |
| `tests/admin/csv-nombres.test.ts` | `tests/admin/csv-numbers.test.ts` |
| `tests/admin/produits-actions.test.ts` | `tests/admin/product-actions.test.ts` |
| `tests/admin/produits-query.test.ts` | `tests/admin/product-query.test.ts` |
| `tests/server/prisma-erreurs.test.ts` | `tests/server/prisma-errors.test.ts` |
| `tests/server/statut.test.ts` | `tests/server/order-status-service.test.ts` |
| `e2e/admin-avis.spec.ts` | `e2e/admin-reviews.spec.ts` |
| `e2e/admin-commandes.spec.ts` | `e2e/admin-orders.spec.ts` |
| `e2e/admin-produits.spec.ts` | `e2e/admin-products.spec.ts` |
| `e2e/utils/compte-membre.ts` | `e2e/utils/member-account.ts` |

`tests/server/statut.test.ts` couvre `appliquerStatut` (`src/server/order-status-service.ts`)
et non la machine à états pure : sa cible est `order-status-service.test.ts`, pas
`status.test.ts` — le fichier de la machine à états s'appelle déjà
`tests/domain/order-status.test.ts`.

**Les dossiers de route ne bougent pas.** `src/app/admin/produits/` reste `produits` : c'est
un segment d'URL, donc du français conforme (§ 5).

---

## 5. Ce qui NE change pas, et pourquoi

Cette section est aussi importante que les précédentes : **un renommage zélé casse plus qu'un
renommage incomplet.**

| Ce qui reste en français | Pourquoi |
| --- | --- |
| **Libellés d'interface** — « Prix », « Catégorie », « Enregistrement… », « Achat vérifié », « Épingler à l'accueil » | C'est une boutique malgache : la spécification impose le français à l'interface. Ce sont aussi les sélecteurs des tests de bout en bout (§ 6.1). |
| **Valeurs de `LIBELLES_*`** | Seules les **clés** changent (elles suivent les valeurs d'énumération). Les chaînes affichées, non. |
| **Messages d'erreur affichés** — « Le nom est requis », « Format non accepté. Utilisez JPEG, PNG, WebP ou AVIF. » | Lus par la propriétaire. |
| **Textes de validation** — `z.config(fr())` dans `src/admin/resource.ts` | Idem. |
| **Commentaires de code** | Tout le dépôt est commenté en français, et c'est la convention. |
| **Messages de commit, documentation, journal** | § 1 de `CONVENTIONS.md`. |
| **Segments de route** — `admin/produits`, `admin/commandes`, `admin/avis`, `connexion`, `acces-refuse` | **Ils sont conformes, pas en retard.** Une URL est lue par un être humain. `admin/produits` ne deviendra jamais `admin/products`. |
| **Noms de migrations existantes** — `20260812210000_index_cles_etrangeres`, `20260812204141_stock_non_negatif` | La table `_prisma_migrations` les indexe **par nom, avec une somme de contrôle** (vérifié le 2026-08-30 : 4 migrations enregistrées). Renommer un dossier de migration fait diverger la base de l'historique. Ce sont des noms historiques, ils restent. |
| **Noms propres** — `orange_money`, `whatsapp`, `Ariary`, `sku` | Ne se traduisent pas. |
| **Champs imposés par Better Auth** — `Session.*`, `Account.*`, `Verification.*`, `banned`, `banReason`, `banExpires`, `impersonatedBy` | Le schéma est celui qu'attend la bibliothèque ; le renommer casse l'adaptateur Prisma. |

---

## 6. Points de vigilance — ce qui casse si on se trompe

### 6.1 Les URL de filtre du back-office portent des valeurs d'énumération

**C'est le piège principal, et celui que ce document existe pour empêcher.** `CONVENTIONS.md`
a longtemps promis un renommage « sans casser un seul test de bout en bout ». C'est faux.

| Preuve | Effet |
| --- | --- |
| `e2e/admin-avis.spec.ts:80` — `page.goto('/admin/avis?statut=en_attente')` | la valeur est en dur dans l'URL : renommée, la page ne filtre plus et le test rougit |
| `e2e/admin-avis.spec.ts:91` — `page.goto('/admin/avis?statut=publie')` | idem |
| `src/app/admin/avis/page.tsx` (`urlListe`) | construit `?statut=<valeur>` à partir de `STATUTS_AVIS` |
| `src/app/admin/commandes/page.tsx` + `src/admin/engine/table.tsx` | `<form method="get">` dont les `<select name="statut">` / `name="canal"` ont pour `value` les valeurs d'énumération : **filtrer produit une URL porteuse d'une valeur** |

**À faire** : réécrire les deux `page.goto` en même temps que la migration, dans le même
commit. Prévenir la propriétaire que ses signets de filtre cesseront de fonctionner.

### 6.2 `AuditLog.avant` / `AuditLog.apres` sont des colonnes `Json` : la migration ne les touche pas

`appliquerStatut` (`src/server/order-status-service.ts:146-147`) écrit
`avant: { statut: de }`, `apres: { statut: vers }` — donc la **chaîne** `'en_preparation'`
dans une colonne `Json`. Un `ALTER TYPE … RENAME VALUE` ne réécrit pas du JSON.

Conséquence, et c'est le pire cas de figure : `libelleStatut` (`src/admin/resources/orders.ts`)
rend telle quelle une valeur inconnue. L'historique de la fiche commande affichera donc
`en_preparation` au lieu de « En préparation » — **sans erreur, sans log, sans test rouge**.

**À faire** : une étape `UPDATE` explicite dans la migration, sur `AuditLog.avant` et
`AuditLog.apres`, pour les entrées `action = 'changement_statut'`. Et la clé JSON `statut`
elle-même devient `status` si l'on renomme le champ — deux transformations, pas une.

**Ce que l'étape 6 a migré, et ce qu'elle a délibérément laissé.** Les colonnes Json portent
bien plus de clés françaises que les seules lignes de changement de statut : `moderer_avis`
écrit `{ statut, epingle }`, `epingler_avis` `{ epingle }`, `supprimer_media`
`{ alt, chemin, isPrimary }`, `importer_temoignage` `{ auteur, note, source, statut }`, et
`creer`/`modifier` y déversent l'objet validé entier (donc toutes les colonnes du modèle).

La migration ne réécrit **que** les lignes `changement_statut`, celles que § 6.2 nomme. Le
critère retenu est celui du raisonnement de cette section elle-même : **on migre le JSON qui
est RELU par du code, on laisse le reste.** Un seul lecteur existe —
`statusFromTrace` (`src/app/admin/commandes/[id]/page.tsx`), qui lit la clé `statut` des
lignes `change_status` pour rendre l'historique de la fiche commande ; c'est exactement le
cas que § 6.2 décrit. Tous les autres contenus sont des **instantanés d'archive** : ils
disent ce que la ligne valait au moment de l'écriture, sous le nom que la colonne portait
alors. Les réécrire ne corrigerait aucun affichage et falsifierait une trace d'audit — dont
l'intérêt est précisément d'être fidèle à son époque. Si un futur écran d'audit affiche ces
objets, il devra tolérer les deux vocabulaires ; c'est une conséquence à connaître, pas une
dette masquée.

### 6.3 `AuditLog.entite` porte des valeurs mixtes, dont trois qui changent

Vérifié : la colonne reçoit à la fois des noms de modèle anglais (`'Order'`, `'Review'`,
`'Variant'`, `'Media'`) et des `resource.name` français (`'produits'`, `'commandes'`,
`'declinaisons'`, via `src/admin/engine/actions.ts` et `src/app/admin/produits/actions.ts:78`).

Un seul endroit relit cette colonne aujourd'hui —
`src/app/admin/commandes/[id]/page.tsx:51`, sur `entite: 'Order'`, qui ne bouge pas. Mais si
`resource.name` passe à `'products'` sans migration des lignes existantes, l'historique d'audit
est coupé en deux : les anciennes lignes disent `produits`, les nouvelles `products`, et le
premier écran d'audit qui filtrera par entité n'en verra qu'une moitié.

**À faire** : `UPDATE "AuditLog" SET entite = 'products' WHERE entite = 'produits'` (idem pour
`commandes` et `declinaisons`), dans la même migration.

### 6.4 `Media.chemin` stocke une valeur, pas seulement un nom de colonne

`Media.chemin` contient `/uploads/<id>-<suffixe>`, et les fichiers correspondants existent sur
le disque. Renommer la **colonne** en `path` est sans risque. **Ne touchez pas à son
contenu** : la valeur stockée est la clé qui relie la base aux fichiers, via
`effacerFichiersMedia`.

### 6.5 `User.nom` est déjà mappé par Better Auth

`src/server/auth.ts` configure `user: { fields: { name: 'nom' } }` : la bibliothèque connaît
le champ sous le nom `name` et l'adaptateur le traduit vers la colonne `nom`. Renommer la
colonne en `name` **rend ce mapping caduc** — il faut le retirer dans le même commit, sinon
l'adaptateur cherche une colonne `nom` qui n'existe plus.

Même vigilance sur `defaultRole: 'membre'` (§ 1.2).

⚠ **Ce mapping existe en TROIS exemplaires, pas un** *(constaté à l'exécution de l'étape 6)* :
`src/server/auth.ts`, mais aussi `prisma/seed.ts` et `e2e/utils/member-account.ts`, qui
montent chacun leur propre instance `betterAuth` minimale (la première parce que
`disableSignUp: true` interdit l'inscription publique, la seconde pour la même raison côté
tests). Cette section n'en nommait qu'un.

Le symptôme du troisième oubli n'est pas une erreur de compilation — `tsc`, `npm test` et
`npm run build` passent tous les trois — mais **un unique test de bout en bout qui rougit
sur `APIError: Failed to create user`**, l'adaptateur cherchant une colonne `nom` disparue.
C'est la raison d'être de la quatrième commande de vérification (`CONVENTIONS.md` § 7) :
sans Playwright, ce défaut partait en revue invisible.

### 6.6 Les sélecteurs de bout en bout ciblent des libellés français

60 appels `getByRole` / `getByLabel` / `getByText` dans `e2e/` (mesuré le 2026-08-30) visent
des libellés français : « Se connecter », « Adresse e-mail », « Publier », « Épingler à
l'accueil », « Importer le témoignage », « Accès réservé ». **Aucun ne doit changer.** Si un
libellé bouge pendant le renommage, c'est une erreur, pas un effet de bord acceptable :
revenez en arrière.

### 6.7 La migration porte sur des données déjà écrites

Comptage du 2026-08-30 sur la base de développement : `Review` 3, `AuditLog` 3, `User` 1,
`Product` 1, `Order` 0, `Promotion` 0. **Ces chiffres ne disent rien de la production** — la
migration doit être écrite comme si les tables étaient pleines.

**Vérifié sur PostgreSQL 17.10 (celui du conteneur) :** `ALTER TYPE … RENAME VALUE`,
`ALTER TYPE … RENAME TO` et `ALTER TABLE … RENAME COLUMN` fonctionnent, **et s'enchaînent
dans une seule transaction** — testé puis annulé par `ROLLBACK`, sans résidu. Le renommage
complet peut donc être une migration transactionnelle unique : soit tout passe, soit rien.

⚠ **Non vérifié, à vérifier avant d'appliquer** : ce que `prisma migrate dev` *génère*. Un
renommage se présente à un outil de diff comme une suppression suivie d'une création, ce qui
détruirait les données. **Générez la migration avec `--create-only`, relisez-la, et
réécrivez-la à la main en `RENAME` si elle contient un `DROP`.** N'appliquez rien sans avoir
lu le SQL.

### 6.8 Ce que la vitrine ajoutera (tâches 13 à 20) — à ne pas créer en français

Le plan V1.0 propose `src/app/(boutique)/…` et
`src/app/api/paiement/[provider]/webhook/route.ts`. Les deux sont **non conformes** :
`(boutique)` doit être `(storefront)` et `api/paiement` doit être `api/payments` (voir
`CONVENTIONS.md` § 1, « Les trois cas que la vitrine va créer »).

⚠ Et un piège qui n'existe pas encore mais qui coûtera cher : le plan fait porter au segment
`[provider]` la valeur `orange_money`, c'est-à-dire une **valeur de l'énumération `Canal`**.
`orange_money` ne change pas dans ce renommage-ci (nom propre), donc rien ne casse
aujourd'hui — mais une URL de webhook communiquée à un prestataire ne doit jamais dépendre
d'une valeur d'énumération qu'on se réserve le droit de renommer. À découpler au moment de la
tâche 19.

### 6.9 Les valeurs de `AuditLog.action` sont françaises, stockées, et relues *(complément du 2026-09-03)*

Trou du même ordre que § 6.3, découvert en préparant l'exécution : treize valeurs françaises
partent en base via `enregistrerAudit`, et **une** est relue comme filtre —
`src/app/admin/commandes/[id]/page.tsx:51` (`action: 'changement_statut'`). Les basculer dans
le code sans migrer les lignes existantes couperait l'historique en deux, exactement comme
pour `resource.name`.

**À faire à l'étape 6 — littéraux du code, filtre de lecture et `UPDATE`, dans le même
commit :**

| Valeur actuelle | Valeur cible |
| --- | --- |
| `creer` | `create` |
| `modifier` | `update` |
| `supprimer` | `delete` |
| `ajustement_stock` | `adjust_stock` |
| `ajout_media` | `add_media` |
| `supprimer_media` | `delete_media` |
| `reordonner_media` | `reorder_media` |
| `modifier_alt_media` | `update_media_alt` |
| `definir_photo_principale` | `set_primary_photo` |
| `changement_statut` | `change_status` |
| `importer_temoignage` | `import_testimonial` |
| `epingler_avis` | `pin_review` |
| `moderer_avis` | `moderate_review` |

*(Cibles alignées sur les noms de fonctions § 3.4 : `deleteMedia`, `reorderMedia`,
`updateMediaAlt`, `setPrimaryPhoto`… Arbitrage par défaut du coordinateur, consigné au
journal.)*

---

## 7. Ordre d'exécution recommandé, et vérification à chaque étape

Un renommage se fait **étape par étape, chacune verte avant la suivante**. Un seul gros
commit rend la revue impossible et le retour arrière coûteux.

**Avant de commencer** : arbre propre, base démarrée
(`docker exec docker-db-1 pg_isready -U summerclub -d summerclub`), et **mesure de départ**
par `npm test` — le chiffre à retrouver à la fin, à consigner au journal.

**Pourquoi l'étape « schéma et base » ne peut pas être verte seule.** Une version antérieure
de ce document séparait cette étape (renommer le schéma et migrer la base) de la suivante
(réécrire les littéraux restants), chacune vérifiée par `tsc --noEmit` puis `npm test`. C'est
inexécutable : dès que `npx prisma generate` régénère les types à partir du schéma renommé,
**tout accès aux champs et valeurs qu'il touche cesse de compiler d'un coup** — y compris dans
`src/domain/`, `src/server/`, `src/admin/` et `src/app/`, déjà « terminés » aux étapes 1 à 4.
Ces étapes ne renommaient que les identifiants **exportés** (§ 3) et internes (§ 3.6) ; elles
ne touchaient jamais un accès de champ comme `commande.statut` ou `avis.texte`, qui reste
français jusqu'à ce que le schéma change. Il n'existe donc aucun état intermédiaire vert entre
« le schéma a changé » et « tout ce qui le consomme a suivi » : les séparer promettait une
étape verte qui ne peut pas exister. La correction : fusionner les deux en un seul palier
(étape 6 ci-dessous), vérifié une seule fois, à la fin.

| # | Étape | Vérification |
| --- | --- | --- |
| 1 | `src/domain/` seul : exports, types, constantes (§ 3.1, § 3.6). Aucune base, aucun schéma. | `npx --no-install tsc --noEmit` puis `npm test` |
| 2 | `src/server/` : erreurs, services, audit, médias (§ 3.2, § 3.6). | idem |
| 3 | `src/admin/` : moteur, ressources, libellés (§ 3.3, § 3.6). ⚠ `resource.name` → prévoir l'`UPDATE` de § 6.3 à l'étape 6. | idem |
| 4 | `src/app/` et `src/components/` : actions, requêtes, composants (§ 3.4, § 3.6). | idem, **et** `npm run build` |
| 5 | `git mv` des 27 fichiers (§ 4), imports mis à jour. | `npx --no-install tsc --noEmit` — un import oublié échoue ici |
| 6 | **Le schéma, la base, et tout ce qui les consomme — un seul commit.** La migration transactionnelle (les 7 types, leurs valeurs françaises, les colonnes de § 1 et § 2, **plus** les `UPDATE` de § 6.2 et § 6.3 ; générée en `--create-only`, relue, réécrite en `RENAME` si besoin) **et**, dans le même commit, chaque accès aux champs et valeurs renommés à travers `src/domain/`, `src/server/`, `src/admin/`, `src/app/`, les littéraux restants des jeux d'essai et assertions, et les deux `page.goto` de § 6.1. | relire le SQL **avant** d'appliquer ; puis `npx prisma generate`, `npm test`, `npx --no-install tsc --noEmit`, `npm run build`, **puis** `npx --no-install playwright test` |
| 7 | La configuration Better Auth (§ 6.5) et le mapping `user.fields`. | connexion réelle en navigateur, pas seulement les tests |

**À la fin, les quatre commandes de `CONVENTIONS.md` § 7**, avec leurs sorties réelles :

```bash
npm test
npx --no-install tsc --noEmit
npm run build
npx --no-install playwright test
```

Et le contrôle qui prouve que le lot est vidé — la commande de `CONVENTIONS.md` § 1 doit
**ne rien renvoyer** :

```bash
git ls-files 'src/*' 'tests/*' 'e2e/*' 'tools/*' 'prisma/seed.ts' \
| grep -vE '/(page|layout|route|loading|error|not-found|template|default)\.[jt]sx?$' \
| grep -E '(^|/)[^/]*(etat|avis|formulaire|temoignage|bouton|statut|declinaison|carte|produit|commande|deconnexion|erreur|champ|systeme|nombre|compte|membre|acces|refuse|connexion|nouveau|panier|prix|remise|zone|livraison)[^/]*\.(ts|tsx|mjs|js)$'
```

**Un chiffre non mesuré se laisse en blanc** (`CONVENTIONS.md` § 7). Ce document ne fige
volontairement aucun compte de tests : mesurez avant, mesurez après, consignez les deux au
journal.
