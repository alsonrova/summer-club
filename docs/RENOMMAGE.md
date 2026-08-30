# Table de correspondance du renommage

**Ce document est la référence de l'agent chargé du renommage des identifiants français vers
l'anglais.** Il existe pour que ce travail soit **mécanique et vérifiable** : chaque nom
source y a son nom cible, chaque piège y est nommé, et l'ordre d'exécution est donné.

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
| `livraison` | `delivery` ⚠ |

⚠ `livraison` désigne ici un **canal de prise de commande**, aux côtés de deux prestataires.
`delivery` est le terme naturel, mais il fait de ce canal un mode de *livraison* alors que
les deux autres sont des *moyens de contact ou de paiement* — l'énumération mélange déjà deux
notions, le renommage ne l'aggrave pas mais ne la corrige pas non plus. Alternative si le
propriétaire préfère nommer le mode de remise : `on_delivery`. **Ne pas trancher seul.**

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
| `annulee` | `cancelled` ⚠ |
| `echec_paiement` | `payment_failed` |

⚠ `cancelled` (deux L, orthographe britannique) plutôt que `canceled` : le reste du dépôt n'a
pas d'usage établi, mais `cancelled` est la forme dominante dans les schémas de commerce
électronique. À trancher une fois, puis à ne plus rediscuter.

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
| `Category` | `ordre` | `position` ⚠ | cohérent avec `Media.position`, déjà anglais |
| `Product` | `nom` | `name` | |
| `Product` | `prixBase` | `basePrice` | |
| `Product` | `prixAchat` | `costPrice` ⚠ | prix d'achat ; `purchasePrice` possible |
| `Product` | `actif` | `active` | |
| `Product` | `ordre` | `position` ⚠ | |
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
| `OrderItem` | `nomFige` | `nameSnapshot` ⚠ | « figé » = capturé à la commande ; `capturedName` possible |
| `OrderItem` | `prixUnitaireFige` | `unitPriceSnapshot` ⚠ | idem |
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
| `Review` | `texte` | `body` ⚠ | `text` plus littéral ; `body` évite la collision avec le type |
| `Review` | `auteur` | `author` | |
| `Review` | `statut` | `status` | |
| `Review` | `epingle` | `pinned` | |
| `DeliveryZone` | `nom` | `name` | |
| `DeliveryZone` | `tarif` | `fee` | cohérent avec `Order.shippingFee` |
| `DeliveryZone` | `delai` | `leadTime` ⚠ | chaîne libre (« 2-3 jours ») ; `eta` possible |
| `DeliveryZone` | `actif` | `active` | |
| `DeliveryZone` | `ordre` | `position` ⚠ | |
| `Setting` | `cle` | `key` | clé primaire |
| `Setting` | `valeur` | `value` | |
| `AuditLog` | `acteur` | `actor` | |
| `AuditLog` | `entite` | `entity` | ⚠ voir § 6.3 — les **valeurs** de cette colonne sont mixtes |
| `AuditLog` | `entiteId` | `entityId` | |
| `AuditLog` | `avant` | `before` | ⚠ voir § 6.2 — colonne `Json`, contenu non migré |
| `AuditLog` | `apres` | `after` | ⚠ idem |

⚠ **`ordre` → `position` (trois modèles).** Alternative : `sortOrder`. `position` a été
retenu parce que `Media.position` existe déjà et est anglais : garder deux noms pour la même
notion serait pire que le choix lui-même. À trancher une fois pour les trois.

**Champs déjà conformes, à ne pas toucher** : `id`, `slug`, `email`, `emailVerified`,
`image`, `description`, `metaTitle`, `metaDescription`, `sku`, `stock`, `reference`, `total`,
`provider`, `idempotencyKey`, `isPrimary`, `alt`, `position`, `createdAt`, `updatedAt`, et
tous les champs de `Session`/`Account`/`Verification` imposés par Better Auth.

---

## 3. Fonctions, types et composants exportés

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
| `epinglerAvis` | `pinReview` |
| `modererAvis` | `moderateReview` |
| `importerTemoignage` | `importTestimonial` |
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
| `epinglerAvisDepuisFormulaire` | `pinReviewFromForm` |
| `modererAvisDepuisFormulaire` | `moderateReviewFromForm` |
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

---

## 7. Ordre d'exécution recommandé, et vérification à chaque étape

Un renommage se fait **étape par étape, chacune verte avant la suivante**. Un seul gros
commit rend la revue impossible et le retour arrière coûteux.

**Avant de commencer** : arbre propre, base démarrée
(`docker exec docker-db-1 pg_isready -U summerclub -d summerclub`), et **mesure de départ**
par `npm test` — le chiffre à retrouver à la fin, à consigner au journal.

| # | Étape | Vérification |
| --- | --- | --- |
| 1 | `src/domain/` seul : exports, types, constantes (§ 3.1). Aucune base, aucun schéma. | `npx --no-install tsc --noEmit` puis `npm test` |
| 2 | `src/server/` : erreurs, services, audit, médias (§ 3.2). | idem |
| 3 | `src/admin/` : moteur, ressources, libellés (§ 3.3). ⚠ `resource.name` → prévoir l'`UPDATE` de § 6.3 à l'étape 6. | idem |
| 4 | `src/app/` et `src/components/` : actions, requêtes, composants (§ 3.4). | idem, **et** `npm run build` |
| 5 | `git mv` des 27 fichiers (§ 4), imports mis à jour. | `npx --no-install tsc --noEmit` — un import oublié échoue ici |
| 6 | **Le schéma et la base**, en une seule migration transactionnelle : les 7 types, leurs valeurs françaises, les colonnes (§ 1 et § 2), **plus** les `UPDATE` de § 6.2 et § 6.3. Générée en `--create-only`, relue, réécrite en `RENAME` si besoin. | relire le SQL **avant** d'appliquer ; puis `npx prisma generate`, `tsc --noEmit`, `npm test` |
| 7 | Les littéraux restants : jeux d'essai, assertions, les deux `page.goto` de § 6.1. | `npm test`, puis `npm run build` **puis** `npx --no-install playwright test` |
| 8 | La configuration Better Auth (§ 6.5) et le mapping `user.fields`. | connexion réelle en navigateur, pas seulement les tests |

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
