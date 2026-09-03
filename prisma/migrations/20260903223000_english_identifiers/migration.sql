-- Renommage des identifiants français vers l'anglais : les sept énumérations, leurs valeurs
-- françaises, et les colonnes de docs/RENOMMAGE.md § 1 et § 2.
--
-- ÉCRITE À LA MAIN, VOLONTAIREMENT. `prisma migrate diff` génère pour ce changement des
-- DROP COLUMN / ADD COLUMN (vérifié avant d'écrire ce fichier) : appliquée telle quelle, sa
-- sortie viderait toutes les colonnes renommées. Un renommage se présente à un outil de diff
-- comme une suppression suivie d'une création — c'est le piège documenté en § 6.7. Ici tout
-- passe donc par RENAME, qui préserve les données.
--
-- Vérifié sur PostgreSQL 17.10 (celui du conteneur), en transaction annulée : un
-- `ALTER TYPE … RENAME VALUE` conserve la valeur par défaut de la colonne (le défaut
-- référence l'OID de l'étiquette, pas son texte) et ne réécrit aucune ligne.
--
-- Prisma enveloppe chaque migration dans une transaction : soit tout passe, soit rien.

-- ---------------------------------------------------------------------------
-- 1. Les sept énumérations (§ 1)
-- ---------------------------------------------------------------------------

-- `Role` : le nom du type est déjà conforme et `admin` est identique dans les deux langues.
ALTER TYPE "Role" RENAME VALUE 'membre' TO 'member';

-- `Canal` → `Channel`. `orange_money` et `whatsapp` sont des noms propres : ils ne se
-- traduisent pas. `livraison` nomme un mode de PAIEMENT (payer à la remise), d'où
-- `cash_on_delivery` et non `delivery` (§ 1.3, tranché par le propriétaire).
ALTER TYPE "Canal" RENAME VALUE 'livraison' TO 'cash_on_delivery';
ALTER TYPE "Canal" RENAME TO "Channel";

-- `StatutCommande` → `OrderStatus` (§ 1.4). `cancelled` avec deux L, forme dominante des
-- schémas de commerce électronique.
ALTER TYPE "StatutCommande" RENAME VALUE 'en_attente_confirmation' TO 'pending_confirmation';
ALTER TYPE "StatutCommande" RENAME VALUE 'en_attente_paiement' TO 'pending_payment';
ALTER TYPE "StatutCommande" RENAME VALUE 'confirmee' TO 'confirmed';
ALTER TYPE "StatutCommande" RENAME VALUE 'en_preparation' TO 'preparing';
ALTER TYPE "StatutCommande" RENAME VALUE 'expediee' TO 'shipped';
ALTER TYPE "StatutCommande" RENAME VALUE 'prete_retrait' TO 'ready_for_pickup';
ALTER TYPE "StatutCommande" RENAME VALUE 'livree' TO 'delivered';
ALTER TYPE "StatutCommande" RENAME VALUE 'annulee' TO 'cancelled';
ALTER TYPE "StatutCommande" RENAME VALUE 'echec_paiement' TO 'payment_failed';
ALTER TYPE "StatutCommande" RENAME TO "OrderStatus";

-- `PortePromo` → `PromotionScope` (§ 1.5).
ALTER TYPE "PortePromo" RENAME VALUE 'produit' TO 'product';
ALTER TYPE "PortePromo" RENAME VALUE 'categorie' TO 'category';
ALTER TYPE "PortePromo" RENAME VALUE 'tout' TO 'all';
ALTER TYPE "PortePromo" RENAME TO "PromotionScope";

-- `TypePromo` → `PromotionType` (§ 1.6). Seul des sept dont TOUTES les valeurs sont déjà
-- anglaises : aucune donnée n'est réécrite pour ce type, seul le nom bouge.
ALTER TYPE "TypePromo" RENAME TO "PromotionType";

-- `SourceAvis` → `ReviewSource` (§ 1.7).
ALTER TYPE "SourceAvis" RENAME VALUE 'verifie' TO 'verified';
ALTER TYPE "SourceAvis" RENAME VALUE 'importe' TO 'imported';
ALTER TYPE "SourceAvis" RENAME TO "ReviewSource";

-- `StatutAvis` → `ReviewStatus` (§ 1.8). L'énumération la plus exposée : ses valeurs
-- voyagent en clair dans les URL de filtre de l'écran avis.
ALTER TYPE "StatutAvis" RENAME VALUE 'en_attente' TO 'pending';
ALTER TYPE "StatutAvis" RENAME VALUE 'publie' TO 'published';
ALTER TYPE "StatutAvis" RENAME VALUE 'rejete' TO 'rejected';
ALTER TYPE "StatutAvis" RENAME TO "ReviewStatus";

-- ---------------------------------------------------------------------------
-- 2. Les colonnes (§ 2)
-- ---------------------------------------------------------------------------

-- `User.nom` → `name` rend caduc le mapping `user: { fields: { name: 'nom' } }` de
-- src/server/auth.ts, retiré dans le même commit (§ 6.5).
ALTER TABLE "User" RENAME COLUMN "nom" TO "name";
ALTER TABLE "User" RENAME COLUMN "tel" TO "phone";

ALTER TABLE "Category" RENAME COLUMN "nom" TO "name";
ALTER TABLE "Category" RENAME COLUMN "ordre" TO "displayOrder";

ALTER TABLE "Product" RENAME COLUMN "nom" TO "name";
ALTER TABLE "Product" RENAME COLUMN "prixBase" TO "basePrice";
ALTER TABLE "Product" RENAME COLUMN "prixAchat" TO "costPrice";
ALTER TABLE "Product" RENAME COLUMN "actif" TO "active";
ALTER TABLE "Product" RENAME COLUMN "ordre" TO "displayOrder";

ALTER TABLE "Variant" RENAME COLUMN "libelle" TO "label";
ALTER TABLE "Variant" RENAME COLUMN "deltaPrix" TO "priceDelta";
ALTER TABLE "Variant" RENAME COLUMN "seuilAlerte" TO "lowStockThreshold";

-- Seule la COLONNE change. Son contenu (`/uploads/<id>-<suffixe>`) est la clé qui relie la
-- base aux fichiers du disque via `deleteMediaFiles` : aucune valeur n'est réécrite (§ 6.4).
ALTER TABLE "Media" RENAME COLUMN "chemin" TO "path";

ALTER TABLE "Order" RENAME COLUMN "tokenSuivi" TO "trackingToken";
ALTER TABLE "Order" RENAME COLUMN "canal" TO "channel";
ALTER TABLE "Order" RENAME COLUMN "statut" TO "status";
ALTER TABLE "Order" RENAME COLUMN "clientNom" TO "customerName";
ALTER TABLE "Order" RENAME COLUMN "tel" TO "phone";
ALTER TABLE "Order" RENAME COLUMN "adresse" TO "address";
ALTER TABLE "Order" RENAME COLUMN "sousTotal" TO "subtotal";
ALTER TABLE "Order" RENAME COLUMN "fraisLivraison" TO "shippingFee";
ALTER TABLE "Order" RENAME COLUMN "remise" TO "discount";

ALTER TABLE "OrderItem" RENAME COLUMN "nomFige" TO "nameSnapshot";
ALTER TABLE "OrderItem" RENAME COLUMN "prixUnitaireFige" TO "unitPriceSnapshot";
ALTER TABLE "OrderItem" RENAME COLUMN "quantite" TO "quantity";

ALTER TABLE "Payment" RENAME COLUMN "montant" TO "amount";
ALTER TABLE "Payment" RENAME COLUMN "statut" TO "status";
ALTER TABLE "Payment" RENAME COLUMN "refExterne" TO "externalRef";
ALTER TABLE "Payment" RENAME COLUMN "payloadBrut" TO "rawPayload";

ALTER TABLE "Promotion" RENAME COLUMN "nom" TO "name";
ALTER TABLE "Promotion" RENAME COLUMN "valeur" TO "value";
ALTER TABLE "Promotion" RENAME COLUMN "portee" TO "scope";
ALTER TABLE "Promotion" RENAME COLUMN "cibleId" TO "targetId";
ALTER TABLE "Promotion" RENAME COLUMN "debut" TO "startsAt";
ALTER TABLE "Promotion" RENAME COLUMN "fin" TO "endsAt";
ALTER TABLE "Promotion" RENAME COLUMN "joursSemaine" TO "weekdays";
ALTER TABLE "Promotion" RENAME COLUMN "heureDebut" TO "startHour";
ALTER TABLE "Promotion" RENAME COLUMN "heureFin" TO "endHour";
ALTER TABLE "Promotion" RENAME COLUMN "membresSeulement" TO "membersOnly";
ALTER TABLE "Promotion" RENAME COLUMN "priorite" TO "priority";
ALTER TABLE "Promotion" RENAME COLUMN "actif" TO "active";

ALTER TABLE "Review" RENAME COLUMN "note" TO "rating";
ALTER TABLE "Review" RENAME COLUMN "texte" TO "body";
ALTER TABLE "Review" RENAME COLUMN "auteur" TO "author";
ALTER TABLE "Review" RENAME COLUMN "statut" TO "status";
ALTER TABLE "Review" RENAME COLUMN "epingle" TO "pinned";

ALTER TABLE "DeliveryZone" RENAME COLUMN "nom" TO "name";
ALTER TABLE "DeliveryZone" RENAME COLUMN "tarif" TO "fee";
ALTER TABLE "DeliveryZone" RENAME COLUMN "delai" TO "leadTime";
ALTER TABLE "DeliveryZone" RENAME COLUMN "actif" TO "active";
ALTER TABLE "DeliveryZone" RENAME COLUMN "ordre" TO "displayOrder";

ALTER TABLE "Setting" RENAME COLUMN "cle" TO "key";
ALTER TABLE "Setting" RENAME COLUMN "valeur" TO "value";

ALTER TABLE "AuditLog" RENAME COLUMN "acteur" TO "actor";
ALTER TABLE "AuditLog" RENAME COLUMN "entite" TO "entity";
ALTER TABLE "AuditLog" RENAME COLUMN "entiteId" TO "entityId";
ALTER TABLE "AuditLog" RENAME COLUMN "avant" TO "before";
ALTER TABLE "AuditLog" RENAME COLUMN "apres" TO "after";

-- ---------------------------------------------------------------------------
-- 3. Les index dérivés des noms de champs
-- ---------------------------------------------------------------------------
-- `RENAME COLUMN` conserve le nom PHYSIQUE de l'index. Prisma, lui, dérive le nom attendu
-- des noms de champs : sans ces renommages, `prisma migrate diff` verrait une dérive
-- permanente entre la base et le schéma (un DROP INDEX / CREATE INDEX à chaque diff).
-- Les six index ci-dessous sont les seuls dont le nom porte un champ renommé.
ALTER INDEX "AuditLog_entite_createdAt_idx" RENAME TO "AuditLog_entity_createdAt_idx";
ALTER INDEX "Order_statut_createdAt_idx" RENAME TO "Order_status_createdAt_idx";
ALTER INDEX "Order_tokenSuivi_key" RENAME TO "Order_trackingToken_key";
ALTER INDEX "Product_actif_ordre_idx" RENAME TO "Product_active_displayOrder_idx";
ALTER INDEX "Review_statut_epingle_idx" RENAME TO "Review_status_pinned_idx";
ALTER INDEX "Variant_productId_libelle_key" RENAME TO "Variant_productId_label_key";

-- ---------------------------------------------------------------------------
-- 4. Les données déjà écrites que le renommage des types NE touche pas
-- ---------------------------------------------------------------------------

-- § 6.2 — `AuditLog.before`/`after` sont des colonnes Json : aucun `ALTER TYPE` ne les
-- réécrit. `applyStatus` y écrit `{ statut: '<valeur>' }`, donc DEUX transformations sont
-- nécessaires : la clé JSON `statut` devient `status`, et la valeur française devient sa
-- traduction. Sans cela l'historique de la fiche commande afficherait `en_preparation` au
-- lieu de « En préparation » — sans erreur, sans log, sans test rouge.
--
-- Le `ELSE` conserve toute valeur inattendue telle quelle plutôt que de la perdre.
UPDATE "AuditLog"
SET "before" = jsonb_set(
      "before" - 'statut',
      '{status}',
      to_jsonb(
        CASE "before" ->> 'statut'
          WHEN 'en_attente_confirmation' THEN 'pending_confirmation'
          WHEN 'en_attente_paiement' THEN 'pending_payment'
          WHEN 'confirmee' THEN 'confirmed'
          WHEN 'en_preparation' THEN 'preparing'
          WHEN 'expediee' THEN 'shipped'
          WHEN 'prete_retrait' THEN 'ready_for_pickup'
          WHEN 'livree' THEN 'delivered'
          WHEN 'annulee' THEN 'cancelled'
          WHEN 'echec_paiement' THEN 'payment_failed'
          ELSE "before" ->> 'statut'
        END
      )
    )
WHERE action = 'changement_statut'
  AND "before" ? 'statut';

UPDATE "AuditLog"
SET "after" = jsonb_set(
      "after" - 'statut',
      '{status}',
      to_jsonb(
        CASE "after" ->> 'statut'
          WHEN 'en_attente_confirmation' THEN 'pending_confirmation'
          WHEN 'en_attente_paiement' THEN 'pending_payment'
          WHEN 'confirmee' THEN 'confirmed'
          WHEN 'en_preparation' THEN 'preparing'
          WHEN 'expediee' THEN 'shipped'
          WHEN 'prete_retrait' THEN 'ready_for_pickup'
          WHEN 'livree' THEN 'delivered'
          WHEN 'annulee' THEN 'cancelled'
          WHEN 'echec_paiement' THEN 'payment_failed'
          ELSE "after" ->> 'statut'
        END
      )
    )
WHERE action = 'changement_statut'
  AND "after" ? 'statut';

-- § 6.3 — `AuditLog.entity` porte des valeurs mixtes : des noms de modèle anglais
-- (`Order`, `Review`, `Variant`, `Media`, qui ne bougent pas) et des `resource.name`
-- français, qui deviennent anglais dans ce même commit. Sans cet UPDATE, l'historique
-- d'audit serait coupé en deux : les anciennes lignes diraient `produits`, les nouvelles
-- `products`.
UPDATE "AuditLog" SET "entity" = 'products' WHERE "entity" = 'produits';
UPDATE "AuditLog" SET "entity" = 'orders' WHERE "entity" = 'commandes';
UPDATE "AuditLog" SET "entity" = 'variants' WHERE "entity" = 'declinaisons';

-- § 6.9 — Les treize valeurs de `AuditLog.action`. Une d'entre elles est relue comme filtre
-- (`change_status`, src/app/admin/commandes/[id]/page.tsx) : les basculer dans le code sans
-- migrer les lignes existantes couperait l'historique en deux, exactement comme ci-dessus.
UPDATE "AuditLog"
SET action = CASE action
      WHEN 'creer' THEN 'create'
      WHEN 'modifier' THEN 'update'
      WHEN 'supprimer' THEN 'delete'
      WHEN 'ajustement_stock' THEN 'adjust_stock'
      WHEN 'ajout_media' THEN 'add_media'
      WHEN 'supprimer_media' THEN 'delete_media'
      WHEN 'reordonner_media' THEN 'reorder_media'
      WHEN 'modifier_alt_media' THEN 'update_media_alt'
      WHEN 'definir_photo_principale' THEN 'set_primary_photo'
      WHEN 'changement_statut' THEN 'change_status'
      WHEN 'importer_temoignage' THEN 'import_testimonial'
      WHEN 'epingler_avis' THEN 'pin_review'
      WHEN 'moderer_avis' THEN 'moderate_review'
      ELSE action
    END
WHERE action IN (
  'creer', 'modifier', 'supprimer', 'ajustement_stock', 'ajout_media', 'supprimer_media',
  'reordonner_media', 'modifier_alt_media', 'definir_photo_principale', 'changement_statut',
  'importer_temoignage', 'epingler_avis', 'moderer_avis'
);
