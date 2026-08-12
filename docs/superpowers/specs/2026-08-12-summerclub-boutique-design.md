# Summer Club — Boutique en ligne · Spécification de conception

- **Date** : 2026-08-12
- **Statut** : validée en brainstorming, en attente de relecture
- **Portée de ce document** : sous-système 1 (vitrine + boutique) et socle du sous-système 2 (back-office)

---

## 1. Contexte

Summer Club est une boutique malgache de bijoux en acier inoxydable plaqué or 18k, présente sur Instagram (`@summerclub.mg`, environ 255 abonnés). Positionnement affiché : « Bijoux solaires — durables, acier inoxydable, plaqué or 18k ». Gamme : colliers, boucles d'oreilles, bracelets, bagues. Cible : femmes jeunes, style d'été, Antananarivo et environs.

La vente se fait aujourd'hui en messagerie directe. L'objectif du projet est de donner à la boutique un site marchand autonome et un outil de gestion, sans casser les habitudes de vente existantes.

### Objectifs

1. Vendre en ligne dès la mise en ligne, sans dépendre d'un accès API externe.
2. Donner une image de marque supérieure à celle d'une page Instagram.
3. Permettre à la propriétaire de gérer catalogue, stock, promotions et commandes sans intervention technique.
4. Piloter le chiffre d'affaires et la marge.

### Non-objectifs

Vente à l'international, revente en gros, marketplace multi-vendeurs, application mobile.

---

## 2. Découpage et périmètre

Le projet se décompose en trois sous-systèmes, chacun avec sa spec, son plan et sa version.

| Version | Sous-système | Contenu |
|---|---|---|
| **V1.0** | Vitrine + boutique + socle admin | Landing, catalogue, fiche produit, panier, tunnel 3 canaux, suivi de commande, dépôt d'avis, et l'admin minimal indispensable : authentification, CRUD produits/variantes/stock, téléversement d'images, liste des commandes avec changement de statut, import de témoignages et épinglage des avis affichés en page d'accueil |
| **V1.1** | Back-office complet | Promotions, happy hour, modération complète des avis, comptes membres, champs SEO éditables, zones de livraison, réglages |
| **V1.2** | Pilotage financier | CA par canal et période, marge, dépenses, valeur de stock, exports CSV/Excel |

### Hors périmètre, explicitement

Multi-langue, multi-devise, liste d'envies, comparateur, chat en direct, parrainage, points de fidélité, intégration transporteur, retours et remboursements automatisés, TVA multi-taux, application mobile, réservation de panier avec expiration.

### Hypothèses actées

- Langue : français uniquement.
- Devise : Ariary malgache (MGA), affichage `45 000 Ar`, sans décimale.
- Fuseau : `Indian/Antananarivo` (UTC+3, sans changement d'heure saisonnier).
- Volume de catalogue attendu : 30 à 150 références. Aucun moteur de recherche externe nécessaire.
- Administration : 1 à 2 personnes, rôle `admin` unique. Un rôle `vendeur` restreint pourra être ajouté ultérieurement.
- Zones de livraison configurables en base, non figées dans le code.

---

## 3. Charte graphique — « Peau et lin »

### 3.1 Principe directeur

Le bijou est le seul élément saturé de la page. Fonds, textes, boutons et bordures restent dans une plage de beiges et de bruns doux. Aucun aplat vif, aucun dégradé, aucune ombre portée colorée.

### 3.2 Palette

| Token | Hex | Usage |
|---|---|---|
| `--sand` | `#F7F3EE` | Fond de page, dominante |
| `--shell` | `#FDFBF8` | Cartes, surfaces élevées, en-tête collant |
| `--clay` | `#EDE5DA` | Blocs secondaires, fond d'image, séparateurs pleins |
| `--taupe` | `#B9A992` | Bordures, icônes décoratives, texte désactivé |
| `--sage` | `#7C8B72` | Accent **décoratif** : filets, badges, survols, aplats |
| `--sage-deep` | `#5E6B55` | Accent **lisible** : liens, boutons pleins, texte accentué |
| `--bark` | `#42392F` | Texte principal, boutons secondaires, pied de page |
| `--bark-soft` | `#6E6255` | Texte secondaire, légendes, métadonnées |

**Contrastes vérifiés (WCAG AA)** :

- `--bark` sur `--sand` : ≈ 10:1
- `--bark-soft` sur `--sand` : ≈ 5,3:1
- `--sage-deep` sur `--sand` : ≈ 5,1:1
- `--shell` sur `--sage-deep` : ≈ 5,6:1
- `--sage` sur `--sand` : ≈ 3,3:1 → **interdit pour du texte**, réservé aux éléments d'interface non textuels et aux très grands titres

Pas de mode sombre sur la vitrine. Le back-office hérite de la même palette.

### 3.3 Typographie

- **Titrage** : Fraunces (variable, axes `opsz`, `wght`, `SOFT`, `WONK`).
- **Courant** : Instrument Sans.

```css
--font-display: 'Fraunces', Georgia, serif;
--font-body: 'Instrument Sans', system-ui, sans-serif;

/* Espace de noms --text-* de Tailwind v4 : génère les utilitaires text-hero, text-h1… */
--text-hero:    clamp(2.75rem, 7vw, 5.25rem);  /* 300 · lh .98 · ls -.02em */
--text-h1:      clamp(2rem, 4.5vw, 3.25rem);   /* 300 · lh 1.08 */
--text-h2:      clamp(1.5rem, 3vw, 2.25rem);   /* 400 · lh 1.15 */
--text-h3:      1.25rem;                        /* 500 · lh 1.3 */
--text-body:    1rem;                           /* 400 · lh 1.7 */
--text-small:   0.875rem;                       /* 400 · lh 1.6 */
--text-eyebrow: 0.6875rem;                      /* 500 · ls .16em · majuscules */
```

Règles : les titres sont en graisse 300, jamais en gras. Les majuscules ne servent qu'aux sur-titres et libellés courts. La longueur de ligne est plafonnée à 68 caractères. Polices sous-groupées en latin, `font-display: swap`.

### 3.4 Élément signature — l'arche

Reprise du motif d'arche présent sur la carte de visite de la boutique, transformé en cadre photo. Appliqué **uniquement** aux photos produit.

```css
--arch: 48% 48% 14px 14px / 32% 32% 4px 4px;
```

Cette forme assure la continuité avec l'identité imprimée, crée une signature reconnaissable, et masque les bords des photographies amateur.

### 3.5 Grille, rythme, formes

- Contenu : largeur maximale 1200 px, grille 12 colonnes, gouttières 24 px (mobile) → 40 px (desktop).
- Espacement : base 4 px, échelle 4/8/12/16/24/32/48/64/96/128. Padding vertical de section : 96 px mobile, 160 px desktop.
- Rayons : 8 px (champs), 16 px (cartes), 999 px (boutons, badges), `--arch` (images produit).
- Bordures : 1 px `--taupe` à 40 % d'opacité. Aucune ombre, sauf l'en-tête collant : `0 1px 0 rgba(185,169,146,.35)`.
- Images : ratio **4:5** imposé partout.

### 3.6 Mouvement

Un seul moment orchestré par écran.

- Entrée au défilement : opacité 0→1, `translateY(16px→0)`, 600 ms, `cubic-bezier(.16,1,.3,1)`, décalage 70 ms entre éléments d'une série.
- Survol produit : bascule vers la photo portée en fondu 400 ms, agrandissement de l'arche de 1,5 %.
- Transitions d'interface : 180 ms `ease-out`.
- `prefers-reduced-motion: reduce` supprime tout déplacement et ne conserve que les fondus.

### 3.7 Iconographie et détails

Lucide, trait 1,5 px, taille 20 px, jamais de version pleine. Taupe pour le décoratif, bark pour le fonctionnel. Prix avec espace insécable et sans décimale. `font-variant-numeric: tabular-nums` dans le panier, les tableaux et le back-office.

### 3.8 Traitement des états

Un article en rupture n'affiche pas un bouton grisé mais une mention textuelle explicite (« Rupture ») et, en V1.1, un lien « Prévenez-moi ». Un bouton désactivé ne donne aucune explication au toucher et est proscrit.

### 3.9 Photographie

Consignes à transmettre à la boutique :

1. Fond uni beige ou lin froissé, lumière du jour indirecte, jamais de flash.
2. Deux photos minimum par produit : une macro à plat, une portée sur peau.
3. Cadrage vertical 4:5, bijou occupant environ 60 % de la hauteur.

Traitement automatique au téléversement : recadrage 4:5, normalisation de luminosité, génération de trois tailles en AVIF et WebP.

---

## 4. Architecture technique

### 4.1 Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 16, App Router, sortie `standalone` |
| Langage | TypeScript strict |
| Style | Tailwind v4 + tokens CSS de la section 3 |
| Base de données | PostgreSQL 17 |
| ORM | Prisma 6 |
| Authentification | Better Auth (sessions en base, lien magique, module admin, limitation de débit) |
| Traitement d'images | sharp au téléversement |
| Validation | Zod, partagée entre formulaire, API et génération d'écrans admin |
| E-mails | Brevo (offre gratuite, 300 envois/jour) |
| Tests | Vitest (unitaire) + Playwright (bout en bout) |
| Statistiques | Umami auto-hébergé |
| Erreurs | GlitchTip auto-hébergé |

### 4.2 Topologie de déploiement

VPS unique Hetzner CX22 (2 vCPU, 4 Go RAM, 40 Go SSD), région Falkenstein, Docker Compose :

```
caddy      → TLS automatique, reverse proxy, en-têtes de sécurité et de cache
app        → Next.js standalone
postgres   → volume nommé, port non exposé à l'extérieur
backup     → cron nocturne : pg_dump + rclone
```

Deux conteneurs supplémentaires (`umami`, `glitchtip`) sont ajoutés au même Compose en V1.1. Ils ne conditionnent pas la mise en ligne de la V1.0.

**Cloudflare en proxy devant le VPS** (offre gratuite) pour absorber la latence Europe → Madagascar (180–250 ms) : images, polices, CSS et JS servis depuis un point de présence proche, seules les pages dynamiques traversent.

### 4.3 Budget de performance

- LCP < 2,5 s en 3G rapide.
- Page produit < 250 Ko hors image.
- Catalogue et fiches produit en rendu statique avec revalidation (`revalidate: 300`).

### 4.4 Sauvegardes

`pg_dump` chiffré et dossier des images expédiés chaque nuit vers Cloudflare R2. Rétention : 7 quotidiennes + 4 hebdomadaires. **Une procédure de restauration écrite et testée intégralement avant la mise en ligne.** Objectif de rétablissement : 2 heures.

---

## 5. Modèle de données

Les montants sont stockés en **entiers d'Ariary**. Aucun flottant, aucune conversion en centimes.

| Table | Champs principaux |
|---|---|
| `products` | slug, nom, description, category_id, prix_base, prix_achat, actif, ordre, meta_title, meta_description |
| `variants` | product_id, libellé, sku, delta_prix, stock, seuil_alerte |
| `media` | product_id, chemin, alt, position, is_primary |
| `categories` | slug, nom, description, image |
| `orders` | référence publique, canal, statut, client_nom, tel, email, zone_id, adresse, sous_total, frais_livraison, remise, total, token_suivi |
| `order_items` | order_id, variant_id, nom_fige, prix_unitaire_fige, quantité |
| `payments` | order_id, provider, montant, statut, ref_externe, payload_brut, idempotency_key |
| `promotions` | type, valeur, portée, cible_id, début, fin, jours_semaine, heure_début, heure_fin, membres_seulement, priorité |
| `reviews` | product_id, order_id (nullable), note, texte, auteur, source, statut, épinglé, position |
| `delivery_zones` | nom, tarif, délai_indicatif, actif |
| `users` | rôle (`admin` \| `membre`), email, nom, tel |
| `expenses` | date, catégorie, libellé, montant, justificatif |
| `settings` | clés/valeurs typées (`orange_money_actif`, numéro WhatsApp, horaires, textes légaux…) |
| `audit_log` | acteur, action, entité, avant, après, date |

**Décisions structurantes** :

- `order_items` fige `nom_fige` et `prix_unitaire_fige` à la commande. Modifier un prix produit ne réécrit jamais l'historique ni la compta.
- `reviews.source` vaut `verifie` (lié à une commande livrée) ou `importe` (témoignage saisi par l'admin depuis Instagram ou WhatsApp). Seul `verifie` affiche le badge « Achat vérifié ».
- `variants.stock` porte la contrainte `CHECK (stock >= 0)`.
- Chaque produit possède au plus **un** axe de déclinaison (taille, longueur ou finition). Pas de matrice croisée.

---

## 6. Règles métier

### 6.1 Moteur de prix

Une table `promotions` unique, un résolveur pur (sans base ni réseau) qui calcule le prix effectif d'une variante à un instant donné.

- **Promotion classique** : `type = percent | fixed`, portée `produit | catégorie | tout`, fenêtre `début`–`fin`.
- **Happy hour** : même table, avec `jours_semaine` (masque binaire) + `heure_début`/`heure_fin`.
- **Promotion membre** : `membres_seulement = true`. C'est la contrepartie du compte optionnel.

Règles d'application :

1. Les fenêtres horaires sont évaluées côté serveur en `Indian/Antananarivo`. L'horloge du navigateur n'est jamais utilisée.
2. En cas de conflit, la promotion de plus haute `priorité` l'emporte.
3. **Une seule promotion s'applique par ligne.** Aucun cumul.
4. Le prix effectif est recalculé côté serveur à la validation de commande. Le prix affiché n'est jamais la source de vérité.

### 6.2 Statuts de commande

```
en_attente_confirmation  → canal WhatsApp, avant reprise de contact
en_attente_paiement      → paiement en ligne initié
confirmee                → payée, ou validée manuellement par l'admin
en_preparation
expediee | prete_retrait
livree
annulee
echec_paiement
```

- Le stock est décrémenté à l'entrée en `confirmee`, y compris pour le paiement à la livraison.
- Une annulation recrédite le stock et écrit une entrée dans `audit_log`.
- L'invitation à déposer un avis part à l'entrée en `livree`.

### 6.3 Stock et concurrence

La validation de commande s'exécute dans une transaction qui verrouille les lignes de variantes concernées (`SELECT … FOR UPDATE`), décrémente, puis écrit la commande. La contrainte `CHECK (stock >= 0)` constitue le filet de sécurité : si elle se déclenche, la transaction est annulée et la cliente reçoit un message explicite. Aucune réservation temporaire de panier.

---

## 7. Tunnel de commande et paiement

### 7.1 Trois canaux

| Canal | Comportement |
|---|---|
| **Orange Money** | Paiement en ligne via l'API. Activable par un réglage booléen en admin |
| **WhatsApp** | Commande enregistrée en `en_attente_confirmation`, message pré-rempli ouvert chez le client |
| **Paiement à la livraison / au retrait** | Commande enregistrée, réglée à la remise |

Les trois créent une vraie commande en base : le stock, les statistiques et la compta restent cohérents quel que soit le canal.

### 7.2 Interface de paiement

```ts
interface PaymentProvider {
  id: 'orange_money' | 'mvola' | 'manual'
  initiate(order, idempotencyKey): Promise<{ redirectUrl?: string; reference: string }>
  handleWebhook(req): Promise<PaymentEvent>
  verify(reference): Promise<PaymentStatus>
}
```

**Justification.** MVola (Telma) détient à Madagascar une part de marché au moins équivalente à celle d'Orange Money. Le limiter à un seul opérateur écarterait une part significative des clientes. MVola n'est pas dans le périmètre V1, mais l'interface doit permettre son ajout sans refonte. Même logique pour Airtel Money.

V1.0 implémente : `orange_money`, `manual`, et un fournisseur factice (`fake`) utilisé en développement et en tests de bout en bout.

### 7.3 Orange Money

Le parcours attendu est de type : obtention d'un jeton OAuth, création d'une commande de paiement web, redirection de la cliente vers la page Orange, retour par `return_url`, et notification serveur sur `notif_url`.

**Dépendance externe** : les points d'entrée exacts, le format des charges utiles et le mode de signature dépendent du contrat marchand Orange Madagascar et de la documentation qui l'accompagne. L'implémentation ne sera finalisée qu'à réception des identifiants. Jusque-là, le fournisseur `fake` valide l'intégralité du tunnel. Cette dépendance ne bloque pas la mise en ligne : les deux autres canaux sont opérationnels.

### 7.4 Garde-fous de paiement

1. **Clé d'idempotence** sur chaque tentative : un double clic ou un rejeu réseau ne crée jamais deux paiements.
2. **Vérification de signature** sur tout webhook entrant.
3. **La commande n'est jamais validée sur le retour navigateur.** Seuls le webhook signé ou une vérification serveur explicite font foi — un retour navigateur est falsifiable.
4. Tout événement de paiement est journalisé brut dans `payments.payload_brut`.

### 7.5 Suivi de commande

Chaque commande génère un `token_suivi` aléatoire non devinable et une URL publique de suivi, transmise par WhatsApp ou e-mail. Ce même token authentifie le dépôt d'un avis vérifié après livraison. Aucun compte n'est requis.

---

## 8. Page d'accueil

Sections, dans l'ordre :

1. **Hero** — image portée pleine largeur, titre en Fraunces 300, sur-titre, appel à l'action vers la boutique.
2. **About** — récit court de la marque : acier inoxydable, plaqué or 18k, résistance à l'eau et à la transpiration. Deux à trois arguments, pas davantage.
3. **Sélection produits** — 6 à 8 produits mis en avant, choisis en admin, en cadres d'arche.
4. **Avis** — 3 avis épinglés par l'admin, badge « Achat vérifié » lorsque applicable.
5. **CTA final** — bandeau vers la boutique, plus les liens Instagram et WhatsApp.

---

## 9. Back-office

### 9.1 Architecture pilotée par schéma

Une entité d'administration se déclare dans un fichier de configuration ; un moteur générique en dérive la table paginée, les filtres, le formulaire, la validation, l'export CSV et le journal d'audit.

```ts
defineResource({
  name: 'products',
  schema: productSchema,        // Zod : formulaire + validation API
  columns: ['nom', 'catégorie', 'prix', 'stock', 'actif'],
  filters: ['catégorie', 'actif', 'stock_bas'],
  actions: ['dupliquer', 'activer', 'exporter'],
})
```

Coût estimé : environ deux jours pour le moteur, puis quelques heures par entité.

**Écrans écrits à la main**, parce qu'ils ne rentrent pas dans le moule : tableau de bord, éditeur de promotions et de happy hour, réorganisation des photos par glisser-déposer, écran de pilotage financier.

### 9.2 Contenu par version

- **V1.0** : authentification, produits, variantes, stock, médias, liste des commandes avec changement de statut, import de témoignages et épinglage des avis.
- **V1.1** : promotions et happy hour, modération complète des avis (file d'attente, validation, rejet), membres, champs SEO éditables, zones de livraison, réglages.
- **V1.2** : CA par période et par canal, marge calculée depuis `prix_achat`, panier moyen, top produits, valeur du stock immobilisé, saisie des dépenses, exports CSV et Excel.

---

## 10. SEO

- `metadata` par page. En V1.0, `meta_title` et `meta_description` existent en base et sont remplis automatiquement depuis le nom et la description du produit ; ils deviennent éditables en admin en V1.1.
- JSON-LD : `Product` (avec `offers`, `availability`, `aggregateRating`), `Organization`, `BreadcrumbList`.
- `sitemap.xml` et `robots.txt` générés depuis la base.
- URL canoniques. Un slug modifié pose une redirection 301 permanente, jamais une 404.
- Images Open Graph générées avec `next/og`.
- Statistiques via Umami : pas de bandeau cookies, page plus légère, données conservées sur le serveur.

---

## 11. Sécurité et données personnelles

- Limitation de débit sur la connexion, le dépôt d'avis et l'initiation de paiement.
- Webhooks vérifiés par signature, rejouables sans effet de bord grâce aux clés d'idempotence.
- Back-office protégé par mot de passe fort, 2FA fortement recommandée.
- En-têtes CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` posés par Caddy.
- Téléversements restreints en type et en taille, images systématiquement ré-encodées par sharp — ce qui neutralise les fichiers piégés.
- Port PostgreSQL jamais exposé publiquement.
- `audit_log` sur toute écriture administrative.
- Données personnelles limitées au strict nécessaire : nom, téléphone, adresse, e-mail si fourni. **Aucune donnée bancaire n'est stockée** : elles restent chez l'opérateur de paiement.

---

## 12. Tests

**Vitest** sur ce qui casse silencieusement :

- résolveur de prix (promotions, happy hour, fenêtres horaires, priorités, exclusion du cumul) ;
- calcul du panier et des frais de livraison ;
- décrémentation et recrédit de stock, y compris en accès concurrent ;
- machine à états des commandes.

**Playwright** sur un parcours unique mais complet — catalogue → fiche produit → panier → commande → confirmation — décliné pour les trois canaux, avec le fournisseur de paiement `fake`.

---

## 13. Risques

| Risque | Traitement |
|---|---|
| Panne du serveur unique | Sauvegardes hors site + procédure de restauration testée avant mise en ligne. Rétablissement visé sous 2 h |
| API Orange Money retardée ou indisponible | Le site vend dès le premier jour par WhatsApp et paiement à la livraison |
| Absence de MVola = clientes perdues | Interface `PaymentProvider` prête ; ajout planifiable en V1.2 |
| Photos de qualité inégale | Cadre en arche, traitement automatique au téléversement, guide de prise de vue |
| Latence depuis Madagascar | Cloudflare en proxy, rendu statique, budget de poids strict |
| Survente sur la dernière pièce | Transaction avec verrouillage de ligne + contrainte `CHECK (stock >= 0)` |
| Maintenance du VPS | Mises à jour de sécurité automatiques, images de conteneurs épinglées par version |

---

## 14. Critères d'acceptation de la V1.0

1. Une visiteuse peut parcourir le catalogue, filtrer par catégorie et ouvrir une fiche produit avec ses déclinaisons.
2. Elle peut ajouter au panier, modifier les quantités, et le panier survit à un rechargement de page.
3. Elle peut commander par les trois canaux ; chaque commande apparaît en base avec son canal et son statut.
4. Le stock est décrémenté exactement une fois par commande confirmée, sans survente possible sous accès concurrent.
5. Elle reçoit une URL de suivi fonctionnelle, accessible sans compte.
6. La page d'accueil affiche Hero, About, sélection produits, avis épinglés et CTA final.
7. L'administratrice peut se connecter, créer un produit avec déclinaisons et photos, ajuster un stock, et changer le statut d'une commande.
8. Chaque fiche produit expose un JSON-LD `Product` valide ; `sitemap.xml` liste les produits actifs.
9. Le budget de performance est tenu : LCP < 2,5 s en 3G rapide sur la page d'accueil et une fiche produit.
10. Les contrastes de la section 3.2 sont respectés sur l'ensemble des écrans.
11. `prefers-reduced-motion` supprime tous les déplacements.
12. La restauration d'une sauvegarde a été exécutée avec succès au moins une fois.

---

## 15. Dépendances externes

| Dépendance | Nécessaire pour | Bloquant ? |
|---|---|---|
| Contrat marchand Orange Money Madagascar + identifiants API | Activation du paiement en ligne | Non — le site vend sans |
| Nom de domaine | Mise en ligne | Oui |
| Photos produit conformes au guide de la section 3.9 | Qualité perçue du catalogue | Non, mais fortement dégradant |
| Numéro WhatsApp Business de la boutique | Canal WhatsApp | Oui |

---

## 16. Suite

Spec suivante à rédiger après livraison de la V1.0 : back-office complet (V1.1), puis pilotage financier (V1.2).
