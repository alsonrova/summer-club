# Summer Club V1.0 — Plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe case à cocher (`- [ ]`).

**Goal :** livrer une boutique en ligne fonctionnelle pour Summer Club — landing, catalogue, panier, commande par trois canaux, suivi — plus le socle d'administration minimal permettant à la propriétaire de gérer catalogue, stock et commandes sans intervention technique.

**Architecture :** application Next.js 16 unique (App Router, sortie `standalone`), rendu statique avec revalidation pour le catalogue, actions serveur pour les écritures. La logique métier sensible — prix, panier, stock, statuts — vit dans des modules purs sous `src/domain/`, sans accès base ni réseau, ce qui la rend testable exhaustivement en isolation. L'accès aux données est concentré dans `src/server/`. Le paiement passe par une interface `PaymentProvider` à implémentations interchangeables.

**Tech Stack :** Next.js 16 · TypeScript strict · Tailwind v4 · PostgreSQL 17 · Prisma 6 · Better Auth · Zod · sharp · Vitest · Playwright · Docker Compose · Caddy

**Spec de référence :** `docs/superpowers/specs/2026-08-12-summerclub-boutique-design.md`

## Global Constraints

- **Langue de l'interface** : français uniquement. Tous les libellés visibles sont en français.
- **Devise** : Ariary malgache. Montants stockés en **entiers** (`Int` Prisma). Jamais de flottant, jamais de centimes. Affichage `45 000 Ar` avec espace insécable `\u00A0`, sans décimale.
- **Fuseau horaire** : toute évaluation de fenêtre temporelle se fait en `Indian/Antananarivo` (UTC+3, sans changement d'heure), côté serveur. L'horloge du navigateur n'est jamais utilisée pour une décision métier.
- **Contrastes** : `--sage` (`#7C8B72`) est interdit pour du texte. Le texte accentué utilise `--sage-deep` (`#5E6B55`).
- **Ratio d'image** : 4:5 partout. Le motif `--arch` s'applique uniquement aux photos produit.
- **Mouvement** : `prefers-reduced-motion: reduce` supprime tout déplacement, ne conserve que les fondus.
- **TypeScript** : `strict: true`. Aucun `any` non justifié par un commentaire.
- **Prix** : le prix effectif est toujours recalculé côté serveur à la validation de commande. Le prix reçu du client n'est jamais une source de vérité.
- **Commits** : un commit par tâche minimum, message en `type: description` (`feat:`, `fix:`, `test:`, `chore:`).

## Structure de fichiers

```
src/
  app/
    (boutique)/
      layout.tsx                 en-tête, pied de page, panier
      page.tsx                   landing
      boutique/page.tsx          catalogue
      boutique/[slug]/page.tsx   fiche produit
      panier/page.tsx
      commande/page.tsx          tunnel
      commande/merci/page.tsx
      suivi/[token]/page.tsx     suivi + dépôt d'avis
    admin/
      layout.tsx                 protection + navigation
      page.tsx                   accueil admin
      [resource]/page.tsx        écrans générés par le moteur
      commandes/page.tsx         écran manuel
      avis/page.tsx              écran manuel
    api/
      paiement/[provider]/webhook/route.ts
    sitemap.ts  robots.ts  opengraph-image.tsx
  domain/                        pur, sans I/O — cœur testé
    money.ts                     formatage et arithmétique Ariary
    pricing.ts                   résolveur de promotions et happy hour
    cart.ts                      totaux panier et frais de livraison
    order-status.ts              machine à états des commandes
    types.ts
  server/
    db.ts                        client Prisma partagé
    products.ts                  lecture catalogue
    orders.ts                    création transactionnelle des commandes
    reviews.ts
    media.ts                     pipeline sharp
    settings.ts
    audit.ts
    auth.ts                      configuration Better Auth
  payments/
    provider.ts                  interface PaymentProvider
    manual.ts  fake.ts  orange-money.ts
    registry.ts
  admin/
    resource.ts                  defineResource + types
    engine/                      table, filtres, formulaire, export CSV
  components/
    ui/                          boutons, champs, badges
    product/                     carte produit, galerie, sélecteur de variante
    layout/                      en-tête, pied de page, tiroir panier
  styles/tokens.css              tokens de la charte
prisma/schema.prisma  prisma/seed.ts
tests/                unitaires Vitest
e2e/                  parcours Playwright
docker/               compose dev et prod, Caddyfile
docs/                 spec, plans, passation, backlog
```

---

# Phase 0 — Socle du projet

### Task 1: Initialisation du projet et tokens de charte

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/styles/tokens.css`
- Test: `tests/tokens.test.ts`

**Interfaces:**
- Consomme : rien.
- Produit : les variables CSS de la charte, disponibles comme utilitaires Tailwind (`bg-sand`, `text-bark`, `rounded-arch`…), et les polices `--font-display` / `--font-body`.

- [ ] **Step 1: Créer le projet**

```bash
cd D:/Projet/summerclub
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --yes
```

- [ ] **Step 2: Activer le mode standalone et le typage strict**

Dans `next.config.ts` :

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  images: { formats: ['image/avif', 'image/webp'] },
  experimental: { typedRoutes: true },
}

export default config
```

Dans `tsconfig.json`, vérifier `"strict": true` et ajouter `"noUncheckedIndexedAccess": true`.

- [ ] **Step 3: Écrire les tokens de la charte**

Créer `src/styles/tokens.css` :

```css
@theme {
  --color-sand: #F7F3EE;
  --color-shell: #FDFBF8;
  --color-clay: #EDE5DA;
  --color-taupe: #B9A992;
  --color-sage: #7C8B72;
  --color-sage-deep: #5E6B55;
  --color-bark: #42392F;
  --color-bark-soft: #6E6255;

  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Instrument Sans', system-ui, sans-serif;

  --text-hero: clamp(2.75rem, 7vw, 5.25rem);
  --text-h1: clamp(2rem, 4.5vw, 3.25rem);
  --text-h2: clamp(1.5rem, 3vw, 2.25rem);
  --text-h3: 1.25rem;
  --text-body: 1rem;
  --text-small: 0.875rem;
  --text-eyebrow: 0.6875rem;

  --radius-arch: 48% 48% 14px 14px / 32% 32% 4px 4px;

  --ease-reveal: cubic-bezier(0.16, 1, 0.3, 1);
}

@layer base {
  :root { color-scheme: light; }
  body {
    background-color: var(--color-sand);
    color: var(--color-bark);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-family: var(--font-display); font-weight: 300; }
  ::selection { background: var(--color-clay); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
```

Dans `src/app/globals.css` :

```css
@import "tailwindcss";
@import "../styles/tokens.css";
```

- [ ] **Step 4: Charger les polices**

Dans `src/app/layout.tsx` :

```tsx
import { Fraunces, Instrument_Sans } from 'next/font/google'
import './globals.css'

const display = Fraunces({
  subsets: ['latin'], display: 'swap', variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'], weight: ['300', '400', '500'],
})
const body = Instrument_Sans({
  subsets: ['latin'], display: 'swap', variable: '--font-instrument',
  weight: ['400', '500'],
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

Puis dans `tokens.css`, faire pointer les familles sur les variables générées :
`--font-display: var(--font-fraunces), Georgia, serif;` et `--font-body: var(--font-instrument), system-ui, sans-serif;`

- [ ] **Step 5: Écrire le test de non-régression des contrastes**

Créer `tests/tokens.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!
}

function ratio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1! + 0.05) / (l2! + 0.05)
}

describe('contrastes de la charte', () => {
  const SAND = '#F7F3EE'
  it('le texte principal dépasse 4.5:1', () => {
    expect(ratio('#42392F', SAND)).toBeGreaterThan(4.5)
  })
  it('le texte secondaire dépasse 4.5:1', () => {
    expect(ratio('#6E6255', SAND)).toBeGreaterThan(4.5)
  })
  it('la sauge lisible dépasse 4.5:1', () => {
    expect(ratio('#5E6B55', SAND)).toBeGreaterThan(4.5)
  })
  it('le blanc sur sauge lisible dépasse 4.5:1', () => {
    expect(ratio('#FDFBF8', '#5E6B55')).toBeGreaterThan(4.5)
  })
  it('la sauge décorative reste sous 4.5:1 — elle ne doit pas servir de couleur de texte', () => {
    expect(ratio('#7C8B72', SAND)).toBeLessThan(4.5)
  })
  it('les tokens du fichier de charte sont ceux de la spec', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    expect(css).toContain('--color-sage-deep: #5E6B55')
    expect(css).toContain('--color-bark: #42392F')
  })
})
```

- [ ] **Step 6: Installer Vitest et lancer les tests**

```bash
npm i -D vitest @vitest/coverage-v8
```

Créer `vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
})
```

Ajouter à `package.json` : `"test": "vitest run"`, `"test:watch": "vitest"`.

Run: `npm test`
Expected: 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "feat: initialisation Next.js 16 et tokens de la charte Peau et lin"
```

---

### Task 2: Base de données et schéma Prisma

**Files:**
- Create: `docker/compose.dev.yml`, `prisma/schema.prisma`, `src/server/db.ts`
- Create: `prisma/migrations/*/migration.sql` (généré, puis complété à la main)
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produit : `prisma` (client partagé) exporté depuis `@/server/db`, et l'ensemble des modèles de la spec §5.

- [ ] **Step 1: Démarrer PostgreSQL**

Créer `docker/compose.dev.yml` :

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: summerclub
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: summerclub
    ports: ["5433:5432"]
    volumes: ["sc_pgdata:/var/lib/postgresql/data"]
volumes:
  sc_pgdata:
```

Run: `docker compose -f docker/compose.dev.yml up -d`

**Si Docker Desktop refuse de démarrer** (panne connue sur cette machine, code de sortie 255) : relancer Docker Desktop une fois, puis, si l'échec persiste, installer PostgreSQL 17 localement et pointer `DATABASE_URL` dessus. Le reste du plan est indifférent à l'origine de la base.

Dans `.env` : `DATABASE_URL="postgresql://summerclub:dev@localhost:5433/summerclub"`

- [ ] **Step 2: Écrire le schéma Prisma**

```bash
npm i -D prisma && npm i @prisma/client
npx prisma init --datasource-provider postgresql
```

Contenu de `prisma/schema.prisma` (extrait des modèles centraux, à compléter avec l'ensemble de la spec §5) :

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Category {
  id       String    @id @default(cuid())
  slug     String    @unique
  nom      String
  description String?
  image    String?
  ordre    Int       @default(0)
  products Product[]
}

model Product {
  id          String    @id @default(cuid())
  slug        String    @unique
  nom         String
  description String
  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])
  prixBase    Int
  prixAchat   Int       @default(0)
  actif       Boolean   @default(true)
  ordre       Int       @default(0)
  metaTitle       String?
  metaDescription String?
  variants    Variant[]
  media       Media[]
  reviews     Review[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([actif, ordre])
}

model Variant {
  id          String  @id @default(cuid())
  productId   String
  product     Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  libelle     String
  sku         String  @unique
  deltaPrix   Int     @default(0)
  stock       Int     @default(0)
  seuilAlerte Int     @default(2)
  orderItems  OrderItem[]

  @@index([productId])
}

model Media {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  chemin    String
  alt       String
  position  Int     @default(0)
  isPrimary Boolean @default(false)

  @@index([productId, position])
}

enum Canal {
  orange_money
  whatsapp
  livraison
}

enum StatutCommande {
  en_attente_confirmation
  en_attente_paiement
  confirmee
  en_preparation
  expediee
  prete_retrait
  livree
  annulee
  echec_paiement
}

model Order {
  id            String   @id @default(cuid())
  reference     String   @unique
  tokenSuivi    String   @unique
  canal         Canal
  statut        StatutCommande @default(en_attente_confirmation)
  clientNom     String
  tel           String
  email         String?
  zoneId        String?
  zone          DeliveryZone? @relation(fields: [zoneId], references: [id])
  adresse       String?
  sousTotal     Int
  fraisLivraison Int
  remise        Int      @default(0)
  total         Int
  items         OrderItem[]
  payments      Payment[]
  reviews       Review[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([statut, createdAt])
}

model OrderItem {
  id              String  @id @default(cuid())
  orderId         String
  order           Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId       String
  variant         Variant @relation(fields: [variantId], references: [id])
  nomFige         String
  prixUnitaireFige Int
  quantite        Int
}

model Payment {
  id             String @id @default(cuid())
  orderId        String
  order          Order  @relation(fields: [orderId], references: [id])
  provider       String
  montant        Int
  statut         String
  refExterne     String?
  payloadBrut    Json?
  idempotencyKey String @unique
  createdAt      DateTime @default(now())
}

enum PortePromo {
  produit
  categorie
  tout
}

enum TypePromo {
  percent
  fixed
}

model Promotion {
  id               String     @id @default(cuid())
  nom              String
  type             TypePromo
  valeur           Int
  portee           PortePromo
  cibleId          String?
  debut            DateTime?
  fin              DateTime?
  joursSemaine     Int        @default(127)
  heureDebut       Int?
  heureFin         Int?
  membresSeulement Boolean    @default(false)
  priorite         Int        @default(0)
  actif            Boolean    @default(true)
}

enum SourceAvis {
  verifie
  importe
}

enum StatutAvis {
  en_attente
  publie
  rejete
}

model Review {
  id        String @id @default(cuid())
  productId String?
  product   Product? @relation(fields: [productId], references: [id])
  orderId   String?
  order     Order?   @relation(fields: [orderId], references: [id])
  note      Int
  texte     String
  auteur    String
  source    SourceAvis
  statut    StatutAvis @default(en_attente)
  epingle   Boolean    @default(false)
  position  Int        @default(0)
  createdAt DateTime   @default(now())
}

model DeliveryZone {
  id      String  @id @default(cuid())
  nom     String
  tarif   Int
  delai   String
  actif   Boolean @default(true)
  ordre   Int     @default(0)
  orders  Order[]
}

model Setting {
  cle    String @id
  valeur Json
}

model AuditLog {
  id        String   @id @default(cuid())
  acteur    String
  action    String
  entite    String
  entiteId  String
  avant     Json?
  apres     Json?
  createdAt DateTime @default(now())

  @@index([entite, createdAt])
}
```

- [ ] **Step 3: Générer la migration**

Run: `npx prisma migrate dev --name init`
Expected: migration créée, base synchronisée.

- [ ] **Step 4: Ajouter la contrainte de stock à la main**

Prisma ne génère pas de contrainte `CHECK`. C'est le filet de sécurité contre la survente, donc il ne doit pas dépendre du code applicatif.

```bash
npx prisma migrate dev --create-only --name stock_non_negatif
```

Dans le fichier de migration créé, écrire :

```sql
ALTER TABLE "Variant" ADD CONSTRAINT "variant_stock_non_negatif" CHECK ("stock" >= 0);
```

Run: `npx prisma migrate dev`

Ajouter dans la foulée les index de clés étrangères — Prisma n'en crée aucun implicitement sur PostgreSQL, et ce sont les chemins de lecture les plus fréquents du projet : `@@index([categoryId])` sur `Product`, `@@index([orderId])` sur `OrderItem` et sur `Payment`, `@@index([productId])` et `@@index([statut, epingle])` sur `Review`. Ajouter aussi `@@unique([productId, libelle])` sur `Variant`, qui empêche deux déclinaisons de même libellé sur un même produit.

Note d'exécution : `prisma migrate dev` refuse de tourner sans terminal interactif dès qu'il doit avertir d'une contrainte d'unicité. Dans ce cas, générer le SQL par différentiel puis l'appliquer :

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<horodatage>_<nom>/migration.sql
npx prisma migrate deploy
```

- [ ] **Step 5: Créer le client partagé**

`src/server/db.ts` :

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 6: Vérifier que la contrainte mord**

Créer `tests/schema.test.ts` :

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/server/db'

let variantId: string

beforeAll(async () => {
  const cat = await prisma.category.create({ data: { slug: 'test-cat', nom: 'Test' } })
  const p = await prisma.product.create({
    data: { slug: 'test-prod', nom: 'Test', description: 'x', categoryId: cat.id, prixBase: 10000 },
  })
  const v = await prisma.variant.create({
    data: { productId: p.id, libelle: 'unique', sku: 'TEST-1', stock: 1 },
  })
  variantId = v.id
})

afterAll(async () => {
  await prisma.variant.deleteMany({ where: { sku: 'TEST-1' } })
  await prisma.product.deleteMany({ where: { slug: 'test-prod' } })
  await prisma.category.deleteMany({ where: { slug: 'test-cat' } })
  await prisma.$disconnect()
})

describe('contrainte de stock', () => {
  it('refuse un stock négatif au niveau de la base', async () => {
    await expect(
      prisma.variant.update({ where: { id: variantId }, data: { stock: -1 } }),
    ).rejects.toThrow()
  })
})
```

Run: `npm test -- tests/schema.test.ts`
Expected: PASS — la mise à jour est rejetée par PostgreSQL.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: schéma Prisma complet et contrainte de stock non négatif"
```

---

# Phase 1 — Domaine pur

Ces quatre modules ne touchent ni la base ni le réseau. Ils concentrent la logique qui casse silencieusement, et sont testés exhaustivement.

### Task 3: Arithmétique et formatage Ariary

**Files:**
- Create: `src/domain/money.ts`
- Test: `tests/domain/money.test.ts`

**Interfaces:**
- Produit : `formatAriary(montant: number): string`, `appliquerPourcentage(montant: number, pct: number): number`.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/domain/money.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { formatAriary, appliquerPourcentage } from '@/domain/money'

describe('formatAriary', () => {
  it('groupe les milliers avec une espace insécable', () => {
    expect(formatAriary(45000)).toBe('45\u00A0000\u00A0Ar')
  })
  it("n'affiche aucune décimale", () => {
    expect(formatAriary(1500)).toBe('1\u00A0500\u00A0Ar')
  })
  it('gère zéro', () => {
    expect(formatAriary(0)).toBe('0\u00A0Ar')
  })
  it('gère les grands montants', () => {
    expect(formatAriary(1250000)).toBe('1\u00A0250\u00A0000\u00A0Ar')
  })
})

describe('appliquerPourcentage', () => {
  it('retourne un entier', () => {
    expect(Number.isInteger(appliquerPourcentage(45000, 15))).toBe(true)
  })
  it('arrondit à l\'entier le plus proche', () => {
    expect(appliquerPourcentage(999, 10)).toBe(899)
  })
  it('ne descend jamais sous zéro', () => {
    expect(appliquerPourcentage(1000, 150)).toBe(0)
  })
  it('un pourcentage nul ne change rien', () => {
    expect(appliquerPourcentage(45000, 0)).toBe(45000)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/domain/money.test.ts`
Expected: FAIL — `Cannot find module '@/domain/money'`.

- [ ] **Step 3: Implémenter**

`src/domain/money.ts` :

```ts
const NBSP = '\u00A0'

export function formatAriary(montant: number): string {
  const entier = Math.round(montant)
  const groupes = entier.toLocaleString('fr-FR').replace(/\s|\u202F/g, NBSP)
  return `${groupes}${NBSP}Ar`
}

export function appliquerPourcentage(montant: number, pourcentage: number): number {
  const remise = Math.round((montant * pourcentage) / 100)
  return Math.max(0, montant - remise)
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/domain/money.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/money.ts tests/domain/money.test.ts
git commit -m "feat: formatage et arithmétique Ariary"
```

---

### Task 4: Résolveur de prix — promotions et happy hour

C'est le module le plus délicat du projet : une erreur y produit des pertes d'argent silencieuses.

**Files:**
- Create: `src/domain/pricing.ts`, `src/domain/types.ts`
- Test: `tests/domain/pricing.test.ts`

**Interfaces:**
- Consomme : `appliquerPourcentage` de `@/domain/money`.
- Produit :
  ```ts
  type PromotionRule = {
    id: string; type: 'percent' | 'fixed'; valeur: number
    portee: 'produit' | 'categorie' | 'tout'; cibleId: string | null
    debut: Date | null; fin: Date | null
    joursSemaine: number; heureDebut: number | null; heureFin: number | null
    membresSeulement: boolean; priorite: number; actif: boolean
  }
  type PrixEffectif = { prixInitial: number; prixFinal: number; promotionId: string | null }
  resolvePrix(args: {
    prixBase: number; productId: string; categoryId: string
    promotions: PromotionRule[]; maintenant: Date; estMembre: boolean
  }): PrixEffectif
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

`tests/domain/pricing.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { resolvePrix } from '@/domain/pricing'
import type { PromotionRule } from '@/domain/types'

const base = (o: Partial<PromotionRule> = {}): PromotionRule => ({
  id: 'p1', type: 'percent', valeur: 20, portee: 'tout', cibleId: null,
  debut: null, fin: null, joursSemaine: 127, heureDebut: null, heureFin: null,
  membresSeulement: false, priorite: 0, actif: true, ...o,
})

// 2026-08-14 est un vendredi. 20h00 à Antananarivo = 17h00 UTC.
const VENDREDI_20H = new Date('2026-08-14T17:00:00Z')
const VENDREDI_23H = new Date('2026-08-14T20:00:00Z')
const args = (p: PromotionRule[], maintenant = VENDREDI_20H, estMembre = false) => ({
  prixBase: 50000, productId: 'prod1', categoryId: 'cat1',
  promotions: p, maintenant, estMembre,
})

describe('resolvePrix', () => {
  it('sans promotion, le prix de base est retourné', () => {
    expect(resolvePrix(args([]))).toEqual({
      prixInitial: 50000, prixFinal: 50000, promotionId: null,
    })
  })

  it('applique une remise en pourcentage', () => {
    expect(resolvePrix(args([base()])).prixFinal).toBe(40000)
  })

  it('applique une remise en montant fixe', () => {
    expect(resolvePrix(args([base({ type: 'fixed', valeur: 5000 })])).prixFinal).toBe(45000)
  })

  it('ignore une promotion inactive', () => {
    expect(resolvePrix(args([base({ actif: false })])).prixFinal).toBe(50000)
  })

  it('ignore une promotion dont la fenêtre de dates est passée', () => {
    const p = base({ debut: new Date('2026-01-01'), fin: new Date('2026-02-01') })
    expect(resolvePrix(args([p])).prixFinal).toBe(50000)
  })

  it('applique une promotion dont la fenêtre de dates est courante', () => {
    const p = base({ debut: new Date('2026-08-01'), fin: new Date('2026-09-01') })
    expect(resolvePrix(args([p])).prixFinal).toBe(40000)
  })

  it('applique un happy hour pendant sa plage horaire', () => {
    const p = base({ heureDebut: 20, heureFin: 22 })
    expect(resolvePrix(args([p], VENDREDI_20H)).prixFinal).toBe(40000)
  })

  it('ignore un happy hour en dehors de sa plage horaire', () => {
    const p = base({ heureDebut: 20, heureFin: 22 })
    expect(resolvePrix(args([p], VENDREDI_23H)).prixFinal).toBe(50000)
  })

  it('ignore un happy hour un jour non couvert par le masque', () => {
    // masque lundi seulement = bit 0
    const p = base({ heureDebut: 20, heureFin: 22, joursSemaine: 0b0000001 })
    expect(resolvePrix(args([p], VENDREDI_20H)).prixFinal).toBe(50000)
  })

  it('ignore une promotion membre pour un visiteur non connecté', () => {
    expect(resolvePrix(args([base({ membresSeulement: true })])).prixFinal).toBe(50000)
  })

  it('applique une promotion membre pour un membre', () => {
    expect(resolvePrix(args([base({ membresSeulement: true })], VENDREDI_20H, true)).prixFinal).toBe(40000)
  })

  it('ignore une promotion ciblant un autre produit', () => {
    const p = base({ portee: 'produit', cibleId: 'autre' })
    expect(resolvePrix(args([p])).prixFinal).toBe(50000)
  })

  it('applique une promotion ciblant la bonne catégorie', () => {
    const p = base({ portee: 'categorie', cibleId: 'cat1' })
    expect(resolvePrix(args([p])).prixFinal).toBe(40000)
  })

  it('ne cumule jamais deux promotions : la plus prioritaire gagne', () => {
    const faible = base({ id: 'faible', valeur: 10, priorite: 1 })
    const forte = base({ id: 'forte', valeur: 30, priorite: 5 })
    const r = resolvePrix(args([faible, forte]))
    expect(r.prixFinal).toBe(35000)
    expect(r.promotionId).toBe('forte')
  })

  it('à priorité égale, la remise la plus avantageuse pour la cliente gagne', () => {
    const a = base({ id: 'a', valeur: 10 })
    const b = base({ id: 'b', valeur: 25 })
    expect(resolvePrix(args([a, b])).promotionId).toBe('b')
  })

  it('ne descend jamais sous zéro', () => {
    expect(resolvePrix(args([base({ type: 'fixed', valeur: 999999 })])).prixFinal).toBe(0)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/domain/pricing.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`src/domain/types.ts` :

```ts
export type PromotionRule = {
  id: string
  type: 'percent' | 'fixed'
  valeur: number
  portee: 'produit' | 'categorie' | 'tout'
  cibleId: string | null
  debut: Date | null
  fin: Date | null
  joursSemaine: number
  heureDebut: number | null
  heureFin: number | null
  membresSeulement: boolean
  priorite: number
  actif: boolean
}

export type PrixEffectif = {
  prixInitial: number
  prixFinal: number
  promotionId: string | null
}
```

`src/domain/pricing.ts` :

```ts
import { appliquerPourcentage } from './money'
import type { PromotionRule, PrixEffectif } from './types'

const FUSEAU = 'Indian/Antananarivo'

/**
 * Décompose une date dans le fuseau de la boutique.
 * Intl est utilisé plutôt qu'un décalage codé en dur pour rester
 * correct si la politique horaire du pays change un jour.
 */
function heureLocale(d: Date): { heure: number; jour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSEAU, hour: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(d)
  const heure = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const noms = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const jour = noms.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? 'Mon')
  return { heure, jour }
}

function estApplicable(
  p: PromotionRule, productId: string, categoryId: string,
  maintenant: Date, estMembre: boolean,
): boolean {
  if (!p.actif) return false
  if (p.membresSeulement && !estMembre) return false

  if (p.portee === 'produit' && p.cibleId !== productId) return false
  if (p.portee === 'categorie' && p.cibleId !== categoryId) return false

  if (p.debut && maintenant < p.debut) return false
  if (p.fin && maintenant > p.fin) return false

  const { heure, jour } = heureLocale(maintenant)
  if (((p.joursSemaine >> jour) & 1) === 0) return false

  if (p.heureDebut !== null && p.heureFin !== null) {
    // Une plage qui franchit minuit (22h → 2h) est traitée comme deux intervalles.
    const dansLaPlage = p.heureDebut <= p.heureFin
      ? heure >= p.heureDebut && heure < p.heureFin
      : heure >= p.heureDebut || heure < p.heureFin
    if (!dansLaPlage) return false
  }

  return true
}

function prixApres(p: PromotionRule, prixBase: number): number {
  return p.type === 'percent'
    ? appliquerPourcentage(prixBase, p.valeur)
    : Math.max(0, prixBase - p.valeur)
}

export function resolvePrix(args: {
  prixBase: number
  productId: string
  categoryId: string
  promotions: PromotionRule[]
  maintenant: Date
  estMembre: boolean
}): PrixEffectif {
  const { prixBase, productId, categoryId, promotions, maintenant, estMembre } = args

  const candidates = promotions
    .filter((p) => estApplicable(p, productId, categoryId, maintenant, estMembre))
    .map((p) => ({ promo: p, prix: prixApres(p, prixBase) }))

  if (candidates.length === 0) {
    return { prixInitial: prixBase, prixFinal: prixBase, promotionId: null }
  }

  // Priorité décroissante, puis prix le plus bas pour la cliente.
  candidates.sort((a, b) =>
    b.promo.priorite - a.promo.priorite || a.prix - b.prix,
  )

  const gagnante = candidates[0]!
  return { prixInitial: prixBase, prixFinal: gagnante.prix, promotionId: gagnante.promo.id }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/domain/pricing.test.ts`
Expected: 16 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pricing.ts src/domain/types.ts tests/domain/pricing.test.ts
git commit -m "feat: résolveur de prix avec promotions, happy hour et exclusion du cumul"
```

---

### Task 5: Totaux du panier et frais de livraison

**Files:**
- Create: `src/domain/cart.ts`
- Test: `tests/domain/cart.test.ts`

**Interfaces:**
- Produit :
  ```ts
  type LignePanier = { variantId: string; prixUnitaire: number; quantite: number }
  type TotauxPanier = { sousTotal: number; fraisLivraison: number; remise: number; total: number }
  calculerTotaux(lignes: LignePanier[], tarifZone: number | null): TotauxPanier
  ```

- [ ] **Step 1: Écrire le test qui échoue**

`tests/domain/cart.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { calculerTotaux } from '@/domain/cart'

describe('calculerTotaux', () => {
  it('additionne les lignes', () => {
    const t = calculerTotaux(
      [{ variantId: 'a', prixUnitaire: 45000, quantite: 2 },
       { variantId: 'b', prixUnitaire: 30000, quantite: 1 }], 5000)
    expect(t.sousTotal).toBe(120000)
  })
  it('ajoute les frais de livraison au total', () => {
    const t = calculerTotaux([{ variantId: 'a', prixUnitaire: 45000, quantite: 1 }], 5000)
    expect(t.total).toBe(50000)
  })
  it('un retrait en boutique n\'ajoute aucun frais', () => {
    const t = calculerTotaux([{ variantId: 'a', prixUnitaire: 45000, quantite: 1 }], 0)
    expect(t.fraisLivraison).toBe(0)
    expect(t.total).toBe(45000)
  })
  it('une zone non choisie compte zéro frais mais ne fait pas échouer le calcul', () => {
    const t = calculerTotaux([{ variantId: 'a', prixUnitaire: 45000, quantite: 1 }], null)
    expect(t.total).toBe(45000)
  })
  it('un panier vide donne un total nul', () => {
    expect(calculerTotaux([], 5000)).toEqual({
      sousTotal: 0, fraisLivraison: 0, remise: 0, total: 0,
    })
  })
  it('tous les montants restent entiers', () => {
    const t = calculerTotaux([{ variantId: 'a', prixUnitaire: 33333, quantite: 3 }], 4500)
    expect(Number.isInteger(t.total)).toBe(true)
    expect(t.total).toBe(104499)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/domain/cart.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/domain/cart.ts` :

```ts
export type LignePanier = { variantId: string; prixUnitaire: number; quantite: number }
export type TotauxPanier = {
  sousTotal: number; fraisLivraison: number; remise: number; total: number
}

export function calculerTotaux(
  lignes: LignePanier[],
  tarifZone: number | null,
): TotauxPanier {
  const sousTotal = lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0)
  // Un panier vide ne facture jamais de livraison.
  const fraisLivraison = sousTotal === 0 ? 0 : (tarifZone ?? 0)
  const remise = 0
  return { sousTotal, fraisLivraison, remise, total: sousTotal + fraisLivraison - remise }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/domain/cart.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/cart.ts tests/domain/cart.test.ts
git commit -m "feat: calcul des totaux du panier"
```

---

### Task 6: Machine à états des commandes

**Files:**
- Create: `src/domain/order-status.ts`
- Test: `tests/domain/order-status.test.ts`

**Interfaces:**
- Produit :
  ```ts
  type Statut = 'en_attente_confirmation' | 'en_attente_paiement' | 'confirmee'
    | 'en_preparation' | 'expediee' | 'prete_retrait' | 'livree'
    | 'annulee' | 'echec_paiement'
  transitionAutorisee(de: Statut, vers: Statut): boolean
  effetSurStock(de: Statut, vers: Statut): 'decrementer' | 'recrediter' | 'aucun'
  ```

- [ ] **Step 1: Écrire le test qui échoue**

`tests/domain/order-status.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { transitionAutorisee, effetSurStock } from '@/domain/order-status'

describe('transitionAutorisee', () => {
  it('autorise le passage de en_attente_paiement à confirmee', () => {
    expect(transitionAutorisee('en_attente_paiement', 'confirmee')).toBe(true)
  })
  it('refuse de revenir de livree à confirmee', () => {
    expect(transitionAutorisee('livree', 'confirmee')).toBe(false)
  })
  it('refuse toute sortie d\'un état terminal', () => {
    expect(transitionAutorisee('annulee', 'confirmee')).toBe(false)
    expect(transitionAutorisee('livree', 'annulee')).toBe(false)
  })
  it('autorise l\'annulation depuis confirmee', () => {
    expect(transitionAutorisee('confirmee', 'annulee')).toBe(true)
  })
  it('refuse une transition vers soi-même', () => {
    expect(transitionAutorisee('confirmee', 'confirmee')).toBe(false)
  })
})

describe('effetSurStock', () => {
  it('décrémente à l\'entrée en confirmee', () => {
    expect(effetSurStock('en_attente_paiement', 'confirmee')).toBe('decrementer')
  })
  it('décrémente aussi depuis en_attente_confirmation', () => {
    expect(effetSurStock('en_attente_confirmation', 'confirmee')).toBe('decrementer')
  })
  it('recrédite à l\'annulation d\'une commande confirmée', () => {
    expect(effetSurStock('confirmee', 'annulee')).toBe('recrediter')
  })
  it('recrédite à l\'annulation depuis en_preparation', () => {
    expect(effetSurStock('en_preparation', 'annulee')).toBe('recrediter')
  })
  it('ne touche pas au stock si la commande n\'a jamais été confirmée', () => {
    expect(effetSurStock('en_attente_paiement', 'echec_paiement')).toBe('aucun')
  })
  it('ne touche pas au stock entre deux états post-confirmation', () => {
    expect(effetSurStock('en_preparation', 'expediee')).toBe('aucun')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/domain/order-status.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/domain/order-status.ts` :

```ts
export type Statut =
  | 'en_attente_confirmation' | 'en_attente_paiement' | 'confirmee'
  | 'en_preparation' | 'expediee' | 'prete_retrait' | 'livree'
  | 'annulee' | 'echec_paiement'

const TRANSITIONS: Record<Statut, Statut[]> = {
  en_attente_confirmation: ['confirmee', 'annulee'],
  en_attente_paiement: ['confirmee', 'echec_paiement', 'annulee'],
  confirmee: ['en_preparation', 'annulee'],
  en_preparation: ['expediee', 'prete_retrait', 'annulee'],
  expediee: ['livree', 'annulee'],
  prete_retrait: ['livree', 'annulee'],
  livree: [],
  annulee: [],
  echec_paiement: ['en_attente_paiement', 'annulee'],
}

/**
 * États dans lesquels le stock est déjà retiré de l'inventaire.
 * `en_attente_paiement` en fait partie : une commande Orange Money réserve
 * le stock dès sa création, puisque l'argent est en vol. La confirmation ne
 * décompte donc pas une seconde fois, et un échec de paiement recrédite.
 */
const STOCK_ENGAGE: Statut[] = [
  'confirmee', 'en_preparation', 'expediee', 'prete_retrait', 'livree',
  'en_attente_paiement',
]

export function transitionAutorisee(de: Statut, vers: Statut): boolean {
  return TRANSITIONS[de].includes(vers)
}

export function effetSurStock(
  de: Statut, vers: Statut,
): 'decrementer' | 'recrediter' | 'aucun' {
  const avant = STOCK_ENGAGE.includes(de)
  const apres = STOCK_ENGAGE.includes(vers)
  if (!avant && apres) return 'decrementer'
  if (avant && !apres) return 'recrediter'
  return 'aucun'
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/domain/order-status.test.ts`
Expected: 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/order-status.ts tests/domain/order-status.test.ts
git commit -m "feat: machine à états des commandes et effets sur le stock"
```

---

# Phase 2 — Accès aux données

### Task 7: Création transactionnelle des commandes, sans survente

Le point de correction le plus important du projet.

**Files:**
- Create: `src/server/orders.ts`, `prisma/seed.ts`
- Test: `tests/server/orders.test.ts`

**Interfaces:**
- Consomme : `prisma` de `@/server/db`, `resolvePrix`, `calculerTotaux`, `effetSurStock`.
- Produit :
  ```ts
  creerCommande(input: {
    lignes: { variantId: string; quantite: number }[]
    canal: 'orange_money' | 'whatsapp' | 'livraison'
    client: { nom: string; tel: string; email?: string; adresse?: string }
    zoneId: string | null
    estMembre: boolean
  }): Promise<{ id: string; reference: string; tokenSuivi: string; total: number }>
  ```
  Lève `RuptureStockError` si le stock est insuffisant.

- [ ] **Step 1: Écrire le jeu de données de test**

`prisma/seed.ts` :

```ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const cat = await prisma.category.upsert({
    where: { slug: 'colliers' }, update: {},
    create: { slug: 'colliers', nom: 'Colliers', ordre: 1 },
  })
  const produit = await prisma.product.upsert({
    where: { slug: 'collier-vahine' }, update: {},
    create: {
      slug: 'collier-vahine', nom: 'Collier Vahiné',
      description: 'Acier inoxydable plaqué or 18k, chaîne fine.',
      categoryId: cat.id, prixBase: 45000, prixAchat: 18000,
    },
  })
  await prisma.variant.upsert({
    where: { sku: 'VAH-45' }, update: { stock: 5 },
    create: { productId: produit.id, libelle: '45 cm', sku: 'VAH-45', stock: 5 },
  })
  await prisma.deliveryZone.upsert({
    where: { id: 'zone-tana' }, update: {},
    create: { id: 'zone-tana', nom: 'Antananarivo centre', tarif: 5000, delai: '24 h' },
  })
}

main().finally(() => prisma.$disconnect())
```

Ajouter à `package.json` : `"prisma": { "seed": "tsx prisma/seed.ts" }` et installer `tsx` en dépendance de développement.

Run: `npx prisma db seed`

- [ ] **Step 2: Écrire le test qui échoue, y compris le test de concurrence**

`tests/server/orders.test.ts` :

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/server/db'
import { creerCommande, RuptureStockError } from '@/server/orders'

async function variantTest(stock: number) {
  const v = await prisma.variant.findUniqueOrThrow({ where: { sku: 'VAH-45' } })
  await prisma.variant.update({ where: { id: v.id }, data: { stock } })
  return v.id
}

const client = { nom: 'Test', tel: '0320000000' }

beforeEach(async () => {
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
})

afterAll(() => prisma.$disconnect())

describe('creerCommande', () => {
  it('crée la commande et décrémente le stock', async () => {
    const variantId = await variantTest(5)
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 2 }], canal: 'livraison',
      client, zoneId: 'zone-tana', estMembre: false,
    })
    expect(c.reference).toMatch(/^SC-/)
    expect(c.total).toBe(45000 * 2 + 5000)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(3)
  })

  it('fige le nom et le prix dans la ligne de commande', async () => {
    const variantId = await variantTest(5)
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 1 }], canal: 'livraison',
      client, zoneId: null, estMembre: false,
    })
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: c.id } })
    expect(item.nomFige).toContain('Collier Vahiné')
    expect(item.prixUnitaireFige).toBe(45000)
  })

  it('refuse une commande dépassant le stock disponible', async () => {
    const variantId = await variantTest(1)
    await expect(creerCommande({
      lignes: [{ variantId, quantite: 3 }], canal: 'livraison',
      client, zoneId: null, estMembre: false,
    })).rejects.toBeInstanceOf(RuptureStockError)
  })

  it("n'écrit aucune commande quand le stock manque", async () => {
    const variantId = await variantTest(1)
    await creerCommande({
      lignes: [{ variantId, quantite: 3 }], canal: 'livraison',
      client, zoneId: null, estMembre: false,
    }).catch(() => {})
    expect(await prisma.order.count()).toBe(0)
  })

  it('ne survend jamais sous accès concurrent', async () => {
    const variantId = await variantTest(1)
    const tentative = () => creerCommande({
      lignes: [{ variantId, quantite: 1 }], canal: 'livraison',
      client, zoneId: null, estMembre: false,
    })
    const resultats = await Promise.allSettled([tentative(), tentative(), tentative()])
    const reussies = resultats.filter((r) => r.status === 'fulfilled')
    expect(reussies).toHaveLength(1)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(0)
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/server/orders.test.ts`
Expected: FAIL — `@/server/orders` introuvable.

> **Le code ci-dessous est le point de départ, pas le livrable.** La revue de cette tâche a démontré trois défauts qu'il faut corriger dès l'écriture : valider les entrées (panier non vide, quantité entière, strictement positive, plafonnée — **contrôle du plafond après agrégation**), **agréger les quantités par déclinaison** avant contrôle et décrément, et **ne jamais combiner `Serializable` avec `FOR UPDATE`** (sous `Serializable`, la transaction bloquée est avortée en 40001 au lieu d'obtenir le verrou, ce qui rejette des ventes légitimes). Refuser aussi les produits et zones désactivés, et exposer des erreurs typées dérivées de `CommandeError`.

- [ ] **Step 4: Implémenter**

`src/server/orders.ts` :

```ts
import { randomBytes } from 'node:crypto'
import { prisma } from './db'
import { resolvePrix } from '@/domain/pricing'
import { calculerTotaux } from '@/domain/cart'
import type { PromotionRule } from '@/domain/types'

export class RuptureStockError extends Error {
  constructor(public readonly variantId: string) {
    super('Stock insuffisant')
    this.name = 'RuptureStockError'
  }
}

function reference(): string {
  return `SC-${randomBytes(6).toString('hex').toUpperCase()}`
}

export async function creerCommande(input: {
  lignes: { variantId: string; quantite: number }[]
  canal: 'orange_money' | 'whatsapp' | 'livraison'
  client: { nom: string; tel: string; email?: string; adresse?: string }
  zoneId: string | null
  estMembre: boolean
}) {
  const statutInitial = input.canal === 'orange_money'
    ? 'en_attente_paiement'
    : input.canal === 'whatsapp'
      ? 'en_attente_confirmation'
      : 'confirmee'

  return prisma.$transaction(async (tx) => {
    // Verrouillage explicite des lignes de variantes, dans un ordre stable
    // pour éviter les interblocages entre transactions concurrentes.
    const ids = [...new Set(input.lignes.map((l) => l.variantId))].sort()
    await tx.$queryRawUnsafe(
      `SELECT id FROM "Variant" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      ids,
    )

    const promotions = (await tx.promotion.findMany({ where: { actif: true } })) as PromotionRule[]
    const maintenant = new Date()

    const lignesCalculees = []
    for (const ligne of input.lignes) {
      const variant = await tx.variant.findUniqueOrThrow({
        where: { id: ligne.variantId }, include: { product: true },
      })
      if (variant.stock < ligne.quantite) throw new RuptureStockError(ligne.variantId)

      const { prixFinal } = resolvePrix({
        prixBase: variant.product.prixBase + variant.deltaPrix,
        productId: variant.productId,
        categoryId: variant.product.categoryId,
        promotions, maintenant, estMembre: input.estMembre,
      })

      lignesCalculees.push({
        variantId: variant.id,
        nomFige: `${variant.product.nom} — ${variant.libelle}`,
        prixUnitaireFige: prixFinal,
        quantite: ligne.quantite,
      })
    }

    const zone = input.zoneId
      ? await tx.deliveryZone.findUnique({ where: { id: input.zoneId } })
      : null

    const totaux = calculerTotaux(
      lignesCalculees.map((l) => ({
        variantId: l.variantId, prixUnitaire: l.prixUnitaireFige, quantite: l.quantite,
      })),
      zone?.tarif ?? null,
    )

    const commande = await tx.order.create({
      data: {
        reference: reference(),
        tokenSuivi: randomBytes(24).toString('base64url'),
        canal: input.canal,
        statut: statutInitial,
        clientNom: input.client.nom,
        tel: input.client.tel,
        email: input.client.email ?? null,
        adresse: input.client.adresse ?? null,
        zoneId: input.zoneId,
        sousTotal: totaux.sousTotal,
        fraisLivraison: totaux.fraisLivraison,
        remise: totaux.remise,
        total: totaux.total,
        items: { create: lignesCalculees },
      },
    })

    // Le stock n'est engagé que si la commande entre directement en confirmee.
    if (statutInitial === 'confirmee') {
      for (const l of lignesCalculees) {
        await tx.variant.update({
          where: { id: l.variantId },
          data: { stock: { decrement: l.quantite } },
        })
      }
    }

    return {
      id: commande.id, reference: commande.reference,
      tokenSuivi: commande.tokenSuivi, total: commande.total,
    }
  }, { timeout: 15000, maxWait: 5000 })
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/server/orders.test.ts`
Expected: 5 tests PASS, dont le test de concurrence qui ne laisse réussir qu'une seule des trois tentatives.

- [ ] **Step 6: Commit**

```bash
git add src/server/orders.ts prisma/seed.ts tests/server/orders.test.ts
git commit -m "feat: création transactionnelle des commandes sans survente possible"
```

---

### Task 8: Pipeline d'images

**Files:**
- Create: `src/server/media.ts`
- Test: `tests/server/media.test.ts`
- Create: `public/uploads/.gitkeep`

**Interfaces:**
- Produit : `traiterImage(buffer: Buffer, nomBase: string): Promise<{ chemin: string; largeurs: number[] }>` — écrit `public/uploads/<nomBase>-<largeur>.avif` et `.webp`, recadré en 4:5.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/server/media.test.ts` :

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { rm, stat } from 'node:fs/promises'
import sharp from 'sharp'
import { traiterImage } from '@/server/media'

afterAll(() => rm('public/uploads/test-img-400.avif', { force: true }))

describe('traiterImage', () => {
  it('produit un fichier au ratio 4:5 exact', async () => {
    const source = await sharp({
      create: { width: 1000, height: 600, channels: 3, background: '#EDE5DA' },
    }).jpeg().toBuffer()

    const { largeurs } = await traiterImage(source, 'test-img')
    expect(largeurs).toEqual([400, 800, 1200])

    const meta = await sharp('public/uploads/test-img-400.avif').metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(500)
  })

  it('écrit aussi une version webp de repli', async () => {
    const source = await sharp({
      create: { width: 800, height: 800, channels: 3, background: '#EDE5DA' },
    }).jpeg().toBuffer()
    await traiterImage(source, 'test-img')
    await expect(stat('public/uploads/test-img-800.webp')).resolves.toBeTruthy()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/server/media.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```bash
npm i sharp
```

`src/server/media.ts` :

```ts
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const LARGEURS = [400, 800, 1200] as const
const DOSSIER = path.join(process.cwd(), 'public', 'uploads')

export async function traiterImage(buffer: Buffer, nomBase: string) {
  await mkdir(DOSSIER, { recursive: true })

  for (const largeur of LARGEURS) {
    const hauteur = Math.round((largeur * 5) / 4)
    // Le ré-encodage systématique neutralise tout contenu piégé
    // dissimulé dans le fichier d'origine.
    const base = sharp(buffer).rotate().resize(largeur, hauteur, {
      fit: 'cover', position: 'attention',
    }).normalise()

    await base.clone().avif({ quality: 62 }).toFile(
      path.join(DOSSIER, `${nomBase}-${largeur}.avif`))
    await base.clone().webp({ quality: 78 }).toFile(
      path.join(DOSSIER, `${nomBase}-${largeur}.webp`))
  }

  return { chemin: `/uploads/${nomBase}`, largeurs: [...LARGEURS] }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/server/media.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/media.ts tests/server/media.test.ts public/uploads/.gitkeep
git commit -m "feat: pipeline de traitement d'images 4:5 en AVIF et WebP"
```

---

# Phase 3 — Authentification et socle d'administration

### Task 9: Authentification

**Files:**
- Create: `src/server/auth.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/admin/layout.tsx`, `src/app/connexion/page.tsx`, `src/app/acces-refuse/page.tsx`, `src/proxy.ts`
- Test: `e2e/admin-auth.spec.ts`

**Interfaces:**
- Produit : `auth` (instance Better Auth), `requireAdmin(): Promise<Session>`.

> **Livré différemment du code ci-dessous — lire ceci avant d'écrire un écran d'administration.**
> La page de connexion vit à `/connexion`, **hors de `/admin`** : placée sous le layout protégé, elle se redirigeait vers elle-même en boucle infinie. `src/app/admin/layout.tsx` appelle donc `requireAdmin()` pour tout `/admin/*`, et toute route d'administration est protégée par construction.
> `requireAdmin()` distingue les deux refus : pas de session → `/connexion` ; session de rôle `membre` → `/acces-refuse`, jamais le formulaire de connexion.
> **Convention obligatoire :** un layout ne suffit pas. Il n'est pas ré-exécuté à chaque navigation, ne s'exécute pas du tout sur une route inexistante, et ne protège ni les Server Actions ni les Route Handlers. **Toute page, toute action serveur et tout Route Handler d'administration doit appeler `requireAdmin()` lui-même.** La lecture de session est mise en cache par requête, ce doublon ne coûte rien.
> `src/proxy.ts` fait une garde optimiste sur `/admin/:path*` (présence du cookie seulement) : c'est un premier filtre, jamais la vérification réelle.

- [ ] **Step 1: Installer et configurer**

```bash
npm i better-auth
```

`src/server/auth.ts` :

```ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from './db'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  plugins: [admin()],
  rateLimit: { enabled: true, window: 60, max: 10 },
})

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/connexion')
  if (session.user.role !== 'admin') redirect('/acces-refuse')
  return session
}
```

Ajouter les modèles Better Auth au schéma Prisma selon sa documentation, puis :

Run: `npx prisma migrate dev --name auth`

- [ ] **Step 2: Protéger le back-office**

`src/app/admin/layout.tsx` :

```tsx
import { requireAdmin } from '@/server/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-screen bg-sand">
      <nav className="border-b border-taupe/40 bg-shell px-6 py-4">
        <span className="font-display text-lg">Summer Club — administration</span>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Écrire le test de bout en bout**

```bash
npm i -D @playwright/test && npx playwright install chromium
```

`e2e/admin-auth.spec.ts` :

```ts
import { test, expect } from '@playwright/test'

test('le back-office est inaccessible sans session', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/connexion/)
})

test('un administrateur connecté atteint le tableau de bord', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail').fill('admin@summerclub.mg')
  await page.getByLabel('Mot de passe').fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL('/admin')
})
```

- [ ] **Step 4: Lancer les tests**

Run: `npx playwright test e2e/admin-auth.spec.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: authentification administrateur et protection du back-office"
```

---

### Task 10: Moteur d'administration piloté par schéma

**Files:**
- Create: `src/admin/resource.ts`, `src/admin/engine/table.tsx`, `src/admin/engine/form.tsx`, `src/admin/engine/actions.ts`, `src/admin/engine/csv.ts`
- Create: `src/server/audit.ts`
- Test: `tests/admin/csv.test.ts`, `tests/admin/resource.test.ts`

**Interfaces:**
- Produit :
  ```ts
  defineResource<T>(config: {
    name: string; label: string; schema: ZodObject<any>
    columns: (keyof T)[]; filters?: string[]; actions?: string[]
  }): ResourceConfig<T>
  versCSV(lignes: Record<string, unknown>[], colonnes: string[]): string
  enregistrerAudit(args: { acteur: string; action: string; entite: string; entiteId: string; avant?: unknown; apres?: unknown }): Promise<void>
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

`tests/admin/csv.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { versCSV } from '@/admin/engine/csv'

describe('versCSV', () => {
  it('écrit l\'en-tête puis les lignes', () => {
    const csv = versCSV([{ nom: 'Collier', prix: 45000 }], ['nom', 'prix'])
    expect(csv).toBe('nom,prix\r\nCollier,45000')
  })
  it('échappe les guillemets et les virgules', () => {
    const csv = versCSV([{ nom: 'Collier "or", fin' }], ['nom'])
    expect(csv).toBe('nom\r\n"Collier ""or"", fin"')
  })
  it('remplace les valeurs absentes par une chaîne vide', () => {
    expect(versCSV([{ nom: 'x' }], ['nom', 'prix'])).toBe('nom,prix\r\nx,')
  })
  it('préfixe les valeurs commençant par = pour bloquer l\'injection de formule', () => {
    const csv = versCSV([{ nom: '=1+1' }], ['nom'])
    expect(csv).toBe("nom\r\n'=1+1")
  })
})
```

`tests/admin/resource.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { defineResource } from '@/admin/resource'

const schema = z.object({ nom: z.string().min(1), prix: z.number().int().positive() })

describe('defineResource', () => {
  it('conserve les colonnes déclarées', () => {
    const r = defineResource({ name: 'produits', label: 'Produits', schema, columns: ['nom', 'prix'] })
    expect(r.columns).toEqual(['nom', 'prix'])
  })
  it('refuse une colonne absente du schéma', () => {
    expect(() => defineResource({
      name: 'produits', label: 'Produits', schema, columns: ['inexistant' as never],
    })).toThrow(/inexistant/)
  })
  it('expose les champs du schéma pour la génération de formulaire', () => {
    const r = defineResource({ name: 'produits', label: 'Produits', schema, columns: ['nom'] })
    expect(r.fields.map((f) => f.name)).toEqual(['nom', 'prix'])
    expect(r.fields.find((f) => f.name === 'prix')?.kind).toBe('number')
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- tests/admin`
Expected: FAIL sur les deux fichiers.

- [ ] **Step 3: Implémenter le générateur CSV**

`src/admin/engine/csv.ts` :

```ts
function echapper(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  let s = String(valeur)
  // Un tableur interprète =, +, -, @ en tête de cellule comme une formule.
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function versCSV(lignes: Record<string, unknown>[], colonnes: string[]): string {
  const entete = colonnes.map(echapper).join(',')
  const corps = lignes.map((l) => colonnes.map((c) => echapper(l[c])).join(','))
  return [entete, ...corps].join('\r\n')
}
```

- [ ] **Step 4: Implémenter defineResource**

`src/admin/resource.ts` :

```ts
import type { ZodObject, ZodRawShape } from 'zod'

export type ChampAdmin = {
  name: string
  kind: 'text' | 'number' | 'boolean' | 'date' | 'select'
  requis: boolean
}

export type ResourceConfig<T> = {
  name: string
  label: string
  schema: ZodObject<ZodRawShape>
  columns: (keyof T)[]
  filters: string[]
  actions: string[]
  fields: ChampAdmin[]
}

function typeDeChamp(def: unknown): ChampAdmin['kind'] {
  const nom = (def as { _def?: { typeName?: string } })._def?.typeName ?? ''
  if (nom === 'ZodNumber') return 'number'
  if (nom === 'ZodBoolean') return 'boolean'
  if (nom === 'ZodDate') return 'date'
  if (nom === 'ZodEnum') return 'select'
  return 'text'
}

export function defineResource<T>(config: {
  name: string
  label: string
  schema: ZodObject<ZodRawShape>
  columns: (keyof T)[]
  filters?: string[]
  actions?: string[]
}): ResourceConfig<T> {
  const shape = config.schema.shape
  const connus = Object.keys(shape)

  for (const col of config.columns) {
    if (!connus.includes(String(col))) {
      throw new Error(
        `defineResource("${config.name}") : la colonne "${String(col)}" n'existe pas dans le schéma`,
      )
    }
  }

  const fields: ChampAdmin[] = connus.map((name) => ({
    name,
    kind: typeDeChamp(shape[name]),
    requis: !shape[name]!.isOptional(),
  }))

  return {
    ...config,
    filters: config.filters ?? [],
    actions: config.actions ?? [],
    fields,
  }
}
```

- [ ] **Step 5: Implémenter le journal d'audit**

`src/server/audit.ts` :

```ts
import { prisma } from './db'

export async function enregistrerAudit(args: {
  acteur: string; action: string; entite: string; entiteId: string
  avant?: unknown; apres?: unknown
}) {
  await prisma.auditLog.create({
    data: {
      acteur: args.acteur, action: args.action,
      entite: args.entite, entiteId: args.entiteId,
      avant: (args.avant ?? null) as never,
      apres: (args.apres ?? null) as never,
    },
  })
}
```

- [ ] **Step 6: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- tests/admin`
Expected: 7 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/admin src/server/audit.ts tests/admin
git commit -m "feat: moteur d'administration piloté par schéma et journal d'audit"
```

---

### Task 11: Écrans produits, variantes et médias

**Files:**
- Create: `src/admin/resources/products.ts`, `src/app/admin/produits/page.tsx`, `src/app/admin/produits/[id]/page.tsx`
- Create: `src/app/admin/produits/actions.ts`
- Test: `e2e/admin-produits.spec.ts`

**Interfaces:**
- Consomme : `defineResource`, `traiterImage`, `enregistrerAudit`.
- Produit : actions serveur `creerProduit`, `modifierProduit`, `ajusterStock`, `televerserMedia`, `reordonnerMedia`.

- [ ] **Step 1: Déclarer la ressource**

`src/admin/resources/products.ts` :

```ts
import { z } from 'zod'
import { defineResource } from '@/admin/resource'

export const productSchema = z.object({
  nom: z.string().min(2, 'Le nom est requis'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Minuscules, chiffres et tirets uniquement'),
  description: z.string().min(10, 'Décrivez le produit en une phrase au moins'),
  categoryId: z.string().min(1, 'Choisissez une catégorie'),
  prixBase: z.number().int().positive('Le prix doit être positif'),
  prixAchat: z.number().int().min(0),
  actif: z.boolean(),
})

export const productsResource = defineResource<z.infer<typeof productSchema>>({
  name: 'produits',
  label: 'Produits',
  schema: productSchema,
  columns: ['nom', 'categoryId', 'prixBase', 'actif'],
  filters: ['categoryId', 'actif'],
  actions: ['dupliquer', 'exporter'],
})
```

- [ ] **Step 2: Écrire l'action serveur de création**

`src/app/admin/produits/actions.ts` :

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { requireAdmin } from '@/server/auth'
import { enregistrerAudit } from '@/server/audit'
import { traiterImage } from '@/server/media'
import { productSchema } from '@/admin/resources/products'

export async function creerProduit(donnees: unknown) {
  const session = await requireAdmin()
  const valide = productSchema.parse(donnees)

  const produit = await prisma.product.create({ data: valide })

  await enregistrerAudit({
    acteur: session.user.email, action: 'creation',
    entite: 'Product', entiteId: produit.id, apres: valide,
  })

  revalidatePath('/boutique')
  return produit
}

export async function ajusterStock(variantId: string, nouveauStock: number) {
  const session = await requireAdmin()
  if (!Number.isInteger(nouveauStock) || nouveauStock < 0) {
    throw new Error('Le stock doit être un entier positif ou nul')
  }

  const avant = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
  const apres = await prisma.variant.update({
    where: { id: variantId }, data: { stock: nouveauStock },
  })

  await enregistrerAudit({
    acteur: session.user.email, action: 'ajustement_stock',
    entite: 'Variant', entiteId: variantId,
    avant: { stock: avant.stock }, apres: { stock: apres.stock },
  })

  revalidatePath('/boutique')
  return apres
}

export async function televerserMedia(productId: string, fichier: File) {
  const session = await requireAdmin()

  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(fichier.type)) {
    throw new Error('Format non accepté. Utilisez JPEG, PNG, WebP ou AVIF.')
  }
  if (fichier.size > 8 * 1024 * 1024) {
    throw new Error('Image trop lourde. Maximum 8 Mo.')
  }

  const buffer = Buffer.from(await fichier.arrayBuffer())
  // traiterImage assainit le nom et y ajoute elle-meme un suffixe aleatoire :
  // inutile d'horodater ici, et surtout ne jamais passer le nom du fichier envoye.
  const { chemin } = await traiterImage(buffer, productId)

  const compte = await prisma.media.count({ where: { productId } })
  const media = await prisma.media.create({
    data: {
      productId, chemin, alt: '', position: compte, isPrimary: compte === 0,
    },
  })

  await enregistrerAudit({
    acteur: session.user.email, action: 'ajout_media',
    entite: 'Media', entiteId: media.id, apres: { chemin },
  })

  revalidatePath('/boutique')
  return media
}
```

- [ ] **Step 3: Écrire le test de bout en bout**

`e2e/admin-produits.spec.ts` :

```ts
import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test('création d\'un produit avec une déclinaison', async ({ page }) => {
  await page.goto('/admin/produits')
  await page.getByRole('link', { name: 'Nouveau produit' }).click()

  await page.getByLabel('Nom').fill('Bracelet Soleil')
  await page.getByLabel('Slug').fill('bracelet-soleil')
  await page.getByLabel('Description').fill('Acier inoxydable plaqué or 18k.')
  await page.getByLabel('Prix').fill('38000')
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(page.getByText('Bracelet Soleil')).toBeVisible()
})

test('le formulaire refuse un prix négatif', async ({ page }) => {
  await page.goto('/admin/produits/nouveau')
  await page.getByLabel('Prix').fill('-100')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Le prix doit être positif')).toBeVisible()
})
```

- [ ] **Step 4: Lancer les tests**

Run: `npx playwright test e2e/admin-produits.spec.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Écrire le guide de prise de vue**

Le traitement automatique corrige le cadrage, pas la lumière. Créer `docs/guide-photo.md` reprenant la spec §3.9, en une page imprimable destinée à la boutique : fond uni beige ou lin froissé, lumière du jour indirecte sans flash, deux photos par produit (macro à plat et portée sur peau), cadrage vertical 4:5, bijou occupant environ 60 % de la hauteur. Ajouter un lien vers ce guide depuis l'écran de téléversement des médias.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: écrans d'administration produits, stock et médias"
```

---

### Task 12: Écran commandes et écran avis

**Files:**
- Create: `src/app/admin/commandes/page.tsx`, `src/app/admin/commandes/actions.ts`
- Create: `src/app/admin/avis/page.tsx`, `src/app/admin/avis/actions.ts`
- Test: `tests/server/statut.test.ts`

**Interfaces:**
- Consomme : `transitionAutorisee`, `effetSurStock` de `@/domain/order-status`.
- Produit :
  - `appliquerStatut(orderId: string, vers: Statut, acteur: string)` — cœur métier, **sans authentification**, dans `src/server/order-status-service.ts`. Appelé par l'action administrateur et par le webhook de paiement, qui n'est pas un administrateur.
  - `changerStatut(orderId: string, vers: Statut)` — action serveur, enveloppe authentifiée d'`appliquerStatut`.
  - `importerTemoignage(input)`, `epinglerAvis(id: string, epingle: boolean)`.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/server/statut.test.ts` :

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/server/db'
import { creerCommande } from '@/server/orders'
import { appliquerStatut } from '@/server/order-status-service'

// Les tests visent appliquerStatut : changerStatut n'en est que
// l'enveloppe authentifiée, et requireAdmin n'a pas de sens hors requête.
const changerStatut = (id: string, vers: Parameters<typeof appliquerStatut>[1]) =>
  appliquerStatut(id, vers, 'test')

let variantId: string

beforeEach(async () => {
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  const v = await prisma.variant.findUniqueOrThrow({ where: { sku: 'VAH-45' } })
  await prisma.variant.update({ where: { id: v.id }, data: { stock: 10 } })
  variantId = v.id
})

afterAll(() => prisma.$disconnect())

describe('changerStatut', () => {
  it('recrédite le stock à l\'annulation d\'une commande confirmée', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 3 }], canal: 'livraison',
      client: { nom: 'T', tel: '0320000000' }, zoneId: null, estMembre: false,
    })
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(7)

    await changerStatut(c.id, 'annulee')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })

  it('refuse une transition interdite', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 1 }], canal: 'livraison',
      client: { nom: 'T', tel: '0320000000' }, zoneId: null, estMembre: false,
    })
    await changerStatut(c.id, 'annulee')
    await expect(changerStatut(c.id, 'expediee')).rejects.toThrow(/transition/i)
  })

  it('ne recrédite pas deux fois si l\'annulation est rejouée', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 2 }], canal: 'livraison',
      client: { nom: 'T', tel: '0320000000' }, zoneId: null, estMembre: false,
    })
    await changerStatut(c.id, 'annulee')
    await changerStatut(c.id, 'annulee').catch(() => {})
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/server/statut.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/server/order-status-service.ts` — le cœur métier, sans authentification :

```ts
import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { enregistrerAudit } from '@/server/audit'
import { transitionAutorisee, effetSurStock, type Statut } from '@/domain/order-status'
import { RuptureStockError } from '@/server/orders'

export async function appliquerStatut(orderId: string, vers: Statut, acteur: string) {
  return prisma.$transaction(async (tx) => {
    const commande = await tx.order.findUniqueOrThrow({
      where: { id: orderId }, include: { items: true },
    })
    const de = commande.statut as Statut

    if (!transitionAutorisee(de, vers)) {
      throw new Error(`Transition interdite : ${de} → ${vers}`)
    }

    const effet = effetSurStock(de, vers)
    for (const item of commande.items) {
      if (effet === 'decrementer') {
        // Une commande WhatsApp n'a rien reserve a la creation : le stock a pu
        // partir entre-temps. On verrouille, on relit, et on refuse proprement
        // plutot que de laisser la contrainte CHECK de la base rattraper le coup.
        await tx.$queryRaw`SELECT id FROM "Variant" WHERE id = ${item.variantId} FOR UPDATE`
        const v = await tx.variant.findUniqueOrThrow({ where: { id: item.variantId } })
        if (v.stock < item.quantite) throw new RuptureStockError(item.variantId)
        await tx.variant.update({
          where: { id: item.variantId }, data: { stock: { decrement: item.quantite } },
        })
      } else if (effet === 'recrediter') {
        await tx.variant.update({
          where: { id: item.variantId }, data: { stock: { increment: item.quantite } },
        })
      }
    }

    const apres = await tx.order.update({ where: { id: orderId }, data: { statut: vers } })

    await enregistrerAudit({
      acteur, action: 'changement_statut',
      entite: 'Order', entiteId: orderId,
      avant: { statut: de }, apres: { statut: vers },
    })

    revalidatePath('/admin/commandes')
    return apres
  }, { timeout: 15000, maxWait: 5000 })
}
```

`src/app/admin/commandes/actions.ts` — l'enveloppe authentifiée :

```ts
'use server'

import { requireAdmin } from '@/server/auth'
import { appliquerStatut } from '@/server/order-status-service'
import type { Statut } from '@/domain/order-status'

export async function changerStatut(orderId: string, vers: Statut) {
  const session = await requireAdmin()
  return appliquerStatut(orderId, vers, session.user.email)
}
```

`src/app/admin/avis/actions.ts` :

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { requireAdmin } from '@/server/auth'

const temoignageSchema = z.object({
  productId: z.string().nullable(),
  note: z.number().int().min(1).max(5),
  texte: z.string().min(5),
  auteur: z.string().min(1),
})

export async function importerTemoignage(donnees: unknown) {
  await requireAdmin()
  const valide = temoignageSchema.parse(donnees)
  // source = importe : jamais de badge « Achat vérifié » sur un témoignage saisi à la main.
  const avis = await prisma.review.create({
    data: { ...valide, source: 'importe', statut: 'publie' },
  })
  revalidatePath('/')
  return avis
}

export async function epinglerAvis(id: string, epingle: boolean) {
  await requireAdmin()
  const avis = await prisma.review.update({ where: { id }, data: { epingle } })
  revalidatePath('/')
  return avis
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/server/statut.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: gestion des statuts de commande et des avis en administration"
```

---

# Phase 4 — Vitrine

### Task 13: Composants de base et carte produit

**Files:**
- Create: `src/components/ui/button.tsx`, `src/components/ui/prix.tsx`, `src/components/product/product-card.tsx`
- Create: `src/components/layout/header.tsx`, `src/components/layout/footer.tsx`
- Test: `tests/components/product-card.test.tsx`

**Interfaces:**
- Produit : `<Button variant="plein" | "contour" />`, `<Prix montant={number} initial?={number} />`, `<ProductCard produit={ProduitVitrine} />`.
  ```ts
  type ProduitVitrine = {
    slug: string; nom: string; prixFinal: number; prixInitial: number
    image: string; imageSecondaire: string | null; enStock: boolean
  }
  ```

- [ ] **Step 1: Écrire le test qui échoue**

```bash
npm i -D @testing-library/react @testing-library/dom jsdom
```

`tests/components/product-card.test.tsx` :

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductCard } from '@/components/product/product-card'

const produit = {
  slug: 'collier-vahine', nom: 'Collier Vahiné',
  prixFinal: 45000, prixInitial: 45000,
  image: '/uploads/x-800.avif', imageSecondaire: null, enStock: true,
}

describe('ProductCard', () => {
  it('affiche le nom et le prix formaté', () => {
    render(<ProductCard produit={produit} />)
    expect(screen.getByText('Collier Vahiné')).toBeDefined()
    expect(screen.getByText('45\u00A0000\u00A0Ar')).toBeDefined()
  })

  it('affiche le prix barré quand une promotion s\'applique', () => {
    render(<ProductCard produit={{ ...produit, prixFinal: 36000 }} />)
    expect(screen.getByText('36\u00A0000\u00A0Ar')).toBeDefined()
    const barre = screen.getByText('45\u00A0000\u00A0Ar')
    expect(barre.tagName.toLowerCase()).toBe('s')
  })

  it('indique la rupture par du texte, pas par un bouton désactivé', () => {
    render(<ProductCard produit={{ ...produit, enStock: false }} />)
    expect(screen.getByText('Rupture')).toBeDefined()
    expect(screen.queryByRole('button', { disabled: true })).toBeNull()
  })

  it('donne un texte alternatif décrivant le produit', () => {
    render(<ProductCard produit={produit} />)
    expect(screen.getByAltText(/Collier Vahiné/)).toBeDefined()
  })
})
```

Ajouter à `vitest.config.ts` : `test: { environment: 'jsdom', ... }` pour les fichiers `.test.tsx`.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/components/product-card.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/components/ui/prix.tsx` :

```tsx
import { formatAriary } from '@/domain/money'

export function Prix({ montant, initial }: { montant: number; initial?: number }) {
  const enPromo = initial !== undefined && initial > montant
  return (
    <span className="tabular-nums text-bark-soft">
      {enPromo && (
        <s className="mr-2 text-taupe">{formatAriary(initial)}</s>
      )}
      <span className={enPromo ? 'text-sage-deep' : undefined}>{formatAriary(montant)}</span>
    </span>
  )
}
```

`src/components/product/product-card.tsx` :

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { Prix } from '@/components/ui/prix'

export type ProduitVitrine = {
  slug: string; nom: string; prixFinal: number; prixInitial: number
  image: string; imageSecondaire: string | null; enStock: boolean
}

export function ProductCard({ produit }: { produit: ProduitVitrine }) {
  return (
    <article className="group">
      <Link href={`/boutique/${produit.slug}`} className="block">
        <div
          className="relative aspect-[4/5] overflow-hidden bg-clay transition-transform duration-500 group-hover:scale-[1.015]"
          style={{ borderRadius: 'var(--radius-arch)' }}
        >
          <Image
            src={produit.image}
            alt={`${produit.nom} — bijou en acier inoxydable plaqué or`}
            fill sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-opacity duration-[400ms] group-hover:opacity-0"
          />
          {produit.imageSecondaire && (
            <Image
              src={produit.imageSecondaire} alt="" aria-hidden fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover opacity-0 transition-opacity duration-[400ms] group-hover:opacity-100"
            />
          )}
        </div>
        <h3 className="mt-3.5 font-display text-[17px] font-normal">{produit.nom}</h3>
      </Link>
      <p className="mt-0.5 text-sm">
        {produit.enStock
          ? <Prix montant={produit.prixFinal} initial={produit.prixInitial} />
          : <span className="text-taupe">Rupture</span>}
      </p>
    </article>
  )
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/components/product-card.test.tsx`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: composants de base et carte produit au cadre en arche"
```

---

### Task 14: Catalogue et fiche produit

**Files:**
- Create: `src/server/products.ts`, `src/app/(boutique)/boutique/page.tsx`, `src/app/(boutique)/boutique/[slug]/page.tsx`
- Create: `src/components/product/gallery.tsx`, `src/components/product/variant-picker.tsx`
- Test: `tests/server/products.test.ts`

**Interfaces:**
- Consomme : `resolvePrix`.
- Produit : `listerProduits(categorieSlug?: string): Promise<ProduitVitrine[]>`, `chargerProduit(slug: string): Promise<FicheProduit | null>`.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/server/products.test.ts` :

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/server/db'
import { listerProduits, chargerProduit } from '@/server/products'

afterAll(() => prisma.$disconnect())

describe('listerProduits', () => {
  it('retourne les produits actifs avec leur prix effectif', async () => {
    const liste = await listerProduits()
    expect(liste.length).toBeGreaterThan(0)
    expect(liste[0]).toHaveProperty('prixFinal')
    expect(liste[0]).toHaveProperty('enStock')
  })

  it('exclut les produits inactifs', async () => {
    const p = await prisma.product.findFirstOrThrow({ where: { slug: 'collier-vahine' } })
    await prisma.product.update({ where: { id: p.id }, data: { actif: false } })
    const liste = await listerProduits()
    expect(liste.find((x) => x.slug === 'collier-vahine')).toBeUndefined()
    await prisma.product.update({ where: { id: p.id }, data: { actif: true } })
  })

  it('marque un produit sans stock comme indisponible', async () => {
    const v = await prisma.variant.findUniqueOrThrow({ where: { sku: 'VAH-45' } })
    await prisma.variant.update({ where: { id: v.id }, data: { stock: 0 } })
    const liste = await listerProduits()
    expect(liste.find((x) => x.slug === 'collier-vahine')?.enStock).toBe(false)
    await prisma.variant.update({ where: { id: v.id }, data: { stock: 5 } })
  })
})

describe('chargerProduit', () => {
  it('retourne null pour un slug inconnu', async () => {
    expect(await chargerProduit('nexiste-pas')).toBeNull()
  })
  it('retourne les déclinaisons avec leur disponibilité', async () => {
    const fiche = await chargerProduit('collier-vahine')
    expect(fiche?.variants[0]).toHaveProperty('disponible')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/server/products.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/server/products.ts` :

```ts
import { prisma } from './db'
import { resolvePrix } from '@/domain/pricing'
import type { PromotionRule } from '@/domain/types'
import type { ProduitVitrine } from '@/components/product/product-card'

export type FicheProduit = ProduitVitrine & {
  description: string
  metaTitle: string
  metaDescription: string
  images: { chemin: string; alt: string }[]
  variants: { id: string; libelle: string; prix: number; disponible: boolean }[]
}

async function promotionsActives(): Promise<PromotionRule[]> {
  return (await prisma.promotion.findMany({ where: { actif: true } })) as PromotionRule[]
}

export async function listerProduits(categorieSlug?: string): Promise<ProduitVitrine[]> {
  const produits = await prisma.product.findMany({
    where: {
      actif: true,
      ...(categorieSlug ? { category: { slug: categorieSlug } } : {}),
    },
    include: { variants: true, media: { orderBy: { position: 'asc' } } },
    orderBy: { ordre: 'asc' },
  })

  const promotions = await promotionsActives()
  const maintenant = new Date()

  return produits.map((p) => {
    const { prixInitial, prixFinal } = resolvePrix({
      prixBase: p.prixBase, productId: p.id, categoryId: p.categoryId,
      promotions, maintenant, estMembre: false,
    })
    return {
      slug: p.slug, nom: p.nom, prixInitial, prixFinal,
      image: p.media[0] ? `${p.media[0].chemin}-800.avif` : '/placeholder-800.avif',
      imageSecondaire: p.media[1] ? `${p.media[1].chemin}-800.avif` : null,
      enStock: p.variants.some((v) => v.stock > 0),
    }
  })
}

export async function chargerProduit(slug: string): Promise<FicheProduit | null> {
  const p = await prisma.product.findUnique({
    where: { slug },
    include: { variants: true, media: { orderBy: { position: 'asc' } } },
  })
  if (!p || !p.actif) return null

  const promotions = await promotionsActives()
  const maintenant = new Date()
  const { prixInitial, prixFinal } = resolvePrix({
    prixBase: p.prixBase, productId: p.id, categoryId: p.categoryId,
    promotions, maintenant, estMembre: false,
  })

  return {
    slug: p.slug, nom: p.nom, description: p.description,
    prixInitial, prixFinal,
    metaTitle: p.metaTitle ?? `${p.nom} — Summer Club`,
    metaDescription: p.metaDescription ?? p.description.slice(0, 155),
    image: p.media[0] ? `${p.media[0].chemin}-1200.avif` : '/placeholder-1200.avif',
    imageSecondaire: p.media[1] ? `${p.media[1].chemin}-1200.avif` : null,
    enStock: p.variants.some((v) => v.stock > 0),
    images: p.media.map((m) => ({ chemin: `${m.chemin}-1200.avif`, alt: m.alt || p.nom })),
    variants: p.variants.map((v) => ({
      id: v.id, libelle: v.libelle,
      prix: prixFinal + v.deltaPrix, disponible: v.stock > 0,
    })),
  }
}
```

- [ ] **Step 4: Écrire les pages**

`src/app/(boutique)/boutique/page.tsx` :

```tsx
import { listerProduits } from '@/server/products'
import { ProductCard } from '@/components/product/product-card'

export const revalidate = 300

export const metadata = {
  title: 'La boutique — Summer Club',
  description: 'Colliers, bracelets, bagues et boucles d\'oreilles en acier inoxydable plaqué or 18k.',
}

export default async function BoutiquePage() {
  const produits = await listerProduits()
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
      <h1 className="text-h1 leading-[1.08]">La boutique</h1>
      <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-4 md:gap-x-8">
        {produits.map((p) => <ProductCard key={p.slug} produit={p} />)}
      </div>
    </main>
  )
}
```

`src/app/(boutique)/boutique/[slug]/page.tsx` — inclut les données structurées :

```tsx
import { notFound } from 'next/navigation'
import { chargerProduit } from '@/server/products'
import { Gallery } from '@/components/product/gallery'
import { VariantPicker } from '@/components/product/variant-picker'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const fiche = await chargerProduit((await params).slug)
  if (!fiche) return {}
  return { title: fiche.metaTitle, description: fiche.metaDescription }
}

export default async function FicheProduitPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const fiche = await chargerProduit((await params).slug)
  if (!fiche) notFound()

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: fiche.nom, description: fiche.metaDescription, image: fiche.image,
    offers: {
      '@type': 'Offer', price: fiche.prixFinal, priceCurrency: 'MGA',
      availability: fiche.enStock
        ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }

  return (
    <main className="mx-auto grid max-w-[1200px] gap-12 px-6 py-24 md:grid-cols-2 md:px-10 md:py-40">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Gallery images={fiche.images} />
      <div>
        <h1 className="text-h1 leading-[1.08]">{fiche.nom}</h1>
        <p className="mt-6 max-w-[68ch] leading-[1.7] text-bark-soft">{fiche.description}</p>
        <VariantPicker fiche={fiche} />
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Écrire le sélecteur de déclinaison et la galerie**

`src/components/product/variant-picker.tsx` :

```tsx
'use client'

import { useState } from 'react'
import { usePanier } from '@/lib/cart-store'
import { Prix } from '@/components/ui/prix'
import type { FicheProduit } from '@/server/products'

export function VariantPicker({ fiche }: { fiche: FicheProduit }) {
  const premiereDispo = fiche.variants.find((v) => v.disponible) ?? fiche.variants[0]
  const [choisie, setChoisie] = useState(premiereDispo?.id ?? '')
  const ajouter = usePanier((s) => s.ajouter)

  const variante = fiche.variants.find((v) => v.id === choisie)
  const multiple = fiche.variants.length > 1

  return (
    <div className="mt-10">
      {multiple && (
        <fieldset>
          <legend className="text-[11px] uppercase tracking-[.16em] text-bark-soft">
            Déclinaison
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {fiche.variants.map((v) => (
              <label key={v.id}>
                <input
                  type="radio" name="variante" value={v.id}
                  checked={choisie === v.id} disabled={!v.disponible}
                  onChange={() => setChoisie(v.id)}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-full border border-taupe/60 px-5 py-2.5 text-sm peer-checked:border-sage-deep peer-checked:bg-clay peer-disabled:cursor-not-allowed peer-disabled:text-taupe peer-disabled:line-through peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage-deep">
                  {v.libelle}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="mt-8 text-lg">
        <Prix montant={variante?.prix ?? fiche.prixFinal} initial={fiche.prixInitial} />
      </p>

      {variante?.disponible ? (
        <button
          type="button"
          onClick={() => ajouter({
            variantId: variante.id,
            nom: `${fiche.nom} — ${variante.libelle}`,
            prixUnitaire: variante.prix,
            image: fiche.image,
          }, 1)}
          className="mt-6 rounded-full bg-sage-deep px-6 py-3 text-[11px] font-medium uppercase tracking-[.1em] text-shell transition-colors duration-[180ms] hover:bg-bark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bark"
        >
          Ajouter au panier
        </button>
      ) : (
        <p className="mt-6 text-sm text-taupe">
          Rupture — cette pièce revient bientôt.
        </p>
      )}
    </div>
  )
}
```

`src/components/product/gallery.tsx` :

```tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'

export function Gallery({ images }: { images: { chemin: string; alt: string }[] }) {
  const [active, setActive] = useState(0)
  if (images.length === 0) return null

  return (
    <div>
      <div
        className="relative aspect-[4/5] overflow-hidden bg-clay"
        style={{ borderRadius: 'var(--radius-arch)' }}
      >
        <Image
          src={images[active]!.chemin} alt={images[active]!.alt}
          fill priority sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex gap-3">
          {images.map((img, i) => (
            <button
              key={img.chemin} type="button" onClick={() => setActive(i)}
              aria-label={`Voir la photo ${i + 1}`}
              aria-current={i === active}
              className={`relative aspect-[4/5] w-16 overflow-hidden rounded-lg ring-1 transition-[box-shadow] duration-[180ms] ${
                i === active ? 'ring-sage-deep' : 'ring-taupe/40'
              }`}
            >
              <Image src={img.chemin} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/server/products.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: catalogue et fiche produit avec données structurées"
```

---

### Task 15: Page d'accueil

**Files:**
- Create: `src/app/(boutique)/page.tsx`
- Create: `src/components/home/hero.tsx`, `src/components/home/about.tsx`, `src/components/home/selection.tsx`, `src/components/home/avis.tsx`, `src/components/home/cta.tsx`
- Create: `src/components/ui/reveal.tsx`
- Test: `e2e/accueil.spec.ts`

**Interfaces:**
- Consomme : `listerProduits`, `prisma`.
- Produit : `<Reveal delay={number}>` — composant d'entrée au défilement en CSS pur, neutralisé par `prefers-reduced-motion`.

- [ ] **Step 1: Écrire le composant d'apparition**

`src/components/ui/reveal.tsx` :

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

export function Reveal(
  { children, delay = 0 }: { children: React.ReactNode; delay?: number },
) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setVisible(true); io.disconnect() }
    }, { rootMargin: '-10% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 600ms var(--ease-reveal) ${delay}ms, transform 600ms var(--ease-reveal) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}
```

La règle `@media (prefers-reduced-motion: reduce)` posée en tâche 1 neutralise `transform` et la durée de transition sans code supplémentaire.

- [ ] **Step 2: Assembler la page**

`src/app/(boutique)/page.tsx` :

```tsx
import { listerProduits } from '@/server/products'
import { prisma } from '@/server/db'
import { Hero } from '@/components/home/hero'
import { About } from '@/components/home/about'
import { Selection } from '@/components/home/selection'
import { Avis } from '@/components/home/avis'
import { CTA } from '@/components/home/cta'

export const revalidate = 300

export const metadata = {
  title: 'Summer Club — Bijoux solaires en acier inoxydable',
  description: 'Bijoux en acier inoxydable plaqué or 18k, pensés pour la mer, la douche et les journées entières. Livraison à Antananarivo.',
}

export default async function Accueil() {
  const [produits, avis] = await Promise.all([
    listerProduits(),
    prisma.review.findMany({
      where: { epingle: true, statut: 'publie' },
      orderBy: { position: 'asc' }, take: 3,
    }),
  ])

  return (
    <>
      <Hero />
      <About />
      <Selection produits={produits.slice(0, 8)} />
      <Avis avis={avis} />
      <CTA />
    </>
  )
}
```

`src/components/home/avis.tsx` — le badge n'apparaît que pour `source === 'verifie'` :

```tsx
import { Reveal } from '@/components/ui/reveal'

type AvisAffiche = { id: string; note: number; texte: string; auteur: string; source: string }

export function Avis({ avis }: { avis: AvisAffiche[] }) {
  if (avis.length === 0) return null
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
      <h2 className="text-h2">Elles les portent</h2>
      <div className="mt-14 grid gap-8 md:grid-cols-3">
        {avis.map((a, i) => (
          <Reveal key={a.id} delay={i * 70}>
            <figure className="rounded-2xl bg-shell p-7 ring-1 ring-taupe/40">
              <p className="text-sm text-taupe" aria-label={`${a.note} sur 5`}>
                {'\u2605'.repeat(a.note)}{'\u2606'.repeat(5 - a.note)}
              </p>
              <blockquote className="mt-4 font-display text-lg leading-[1.4]">
                {a.texte}
              </blockquote>
              <figcaption className="mt-5 text-sm text-bark-soft">
                {a.auteur}
                {a.source === 'verifie' && (
                  <span className="ml-2 rounded-full bg-clay px-2.5 py-1 text-[11px] uppercase tracking-[.1em] text-bark">
                    Achat vérifié
                  </span>
                )}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
```

`src/components/home/hero.tsx` — la seule image en `priority` du site, puisqu'elle porte le LCP :

```tsx
import Image from 'next/image'
import Link from 'next/link'

export function Hero() {
  return (
    <section className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-6 py-24 md:grid-cols-[1.1fr_1fr] md:px-10 md:py-40">
      <div>
        <p className="text-[11px] uppercase tracking-[.16em] text-bark-soft">
          Nouvelle saison
        </p>
        <h1 className="mt-5 text-hero font-light leading-[.98] tracking-[-.02em]">
          Le bijou<br />que vous<br />
          <span className="font-medium text-sage-deep">oubliez</span>
        </h1>
        <p className="mt-6 max-w-[38ch] leading-[1.7] text-bark-soft">
          Acier inoxydable plaqué or 18k. Assez léger pour dormir avec,
          assez solide pour l'été entier.
        </p>
        <Link
          href="/boutique"
          className="mt-9 inline-block rounded-full bg-sage-deep px-7 py-3.5 text-[11px] font-medium uppercase tracking-[.1em] text-shell transition-colors duration-[180ms] hover:bg-bark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bark"
        >
          La boutique
        </Link>
      </div>

      <div
        className="relative aspect-[4/5] overflow-hidden bg-clay"
        style={{ borderRadius: 'var(--radius-arch)' }}
      >
        <Image
          src="/hero-1200.avif"
          alt="Mannequin portant un collier fin en acier plaqué or, lumière naturelle"
          fill priority sizes="(max-width: 768px) 100vw, 45vw"
          className="object-cover"
        />
      </div>
    </section>
  )
}
```

Écrire ensuite `about.tsx`, `selection.tsx` et `cta.tsx` en suivant la même structure : conteneur `mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40`, titre en `text-h2`, corps en `text-bark-soft leading-[1.7]` limité à `max-w-[68ch]`, et chaque groupe d'éléments enveloppé dans `<Reveal delay={i * 70}>`. `about.tsx` porte trois arguments au maximum (acier inoxydable, plaqué or 18k, résistant à l'eau et à la transpiration). `selection.tsx` réutilise `<ProductCard>` dans la même grille que le catalogue. `cta.tsx` contient un lien vers `/boutique` et les liens Instagram et WhatsApp.

- [ ] **Step 3: Écrire le test de bout en bout**

`e2e/accueil.spec.ts` :

```ts
import { test, expect } from '@playwright/test'

test('la page d\'accueil présente les cinq sections attendues', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: /notre histoire|la marque/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /sélection/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /elles les portent/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /la boutique/i }).last()).toBeVisible()
})

test('un seul h1 par page', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveCount(1)
})
```

- [ ] **Step 4: Lancer les tests**

Run: `npx playwright test e2e/accueil.spec.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: page d'accueil complète avec apparitions au défilement"
```

---

# Phase 5 — Panier, commande et paiement

### Task 16: Panier persistant

**Files:**
- Create: `src/lib/cart-store.ts`, `src/components/layout/cart-drawer.tsx`, `src/app/(boutique)/panier/page.tsx`
- Test: `tests/lib/cart-store.test.ts`

**Interfaces:**
- Produit : store Zustand `usePanier` avec `{ lignes, ajouter, retirer, changerQuantite, vider }`, persisté dans `localStorage` sous la clé `sc-panier-v1`.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/lib/cart-store.test.ts` :

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { usePanier } from '@/lib/cart-store'

beforeEach(() => usePanier.getState().vider())

const ligne = { variantId: 'v1', nom: 'Collier — 45 cm', prixUnitaire: 45000, image: '/x.avif' }

describe('usePanier', () => {
  it('ajoute une ligne', () => {
    usePanier.getState().ajouter(ligne, 1)
    expect(usePanier.getState().lignes).toHaveLength(1)
  })
  it('incrémente au lieu de dupliquer une variante déjà présente', () => {
    usePanier.getState().ajouter(ligne, 1)
    usePanier.getState().ajouter(ligne, 2)
    expect(usePanier.getState().lignes).toHaveLength(1)
    expect(usePanier.getState().lignes[0]!.quantite).toBe(3)
  })
  it('retire une ligne quand sa quantité tombe à zéro', () => {
    usePanier.getState().ajouter(ligne, 1)
    usePanier.getState().changerQuantite('v1', 0)
    expect(usePanier.getState().lignes).toHaveLength(0)
  })
  it('refuse une quantité négative', () => {
    usePanier.getState().ajouter(ligne, 1)
    usePanier.getState().changerQuantite('v1', -5)
    expect(usePanier.getState().lignes).toHaveLength(0)
  })
  it('plafonne la quantité à 20 par ligne', () => {
    usePanier.getState().ajouter(ligne, 99)
    expect(usePanier.getState().lignes[0]!.quantite).toBe(20)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/lib/cart-store.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```bash
npm i zustand
```

`src/lib/cart-store.ts` :

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LigneUI = {
  variantId: string; nom: string; prixUnitaire: number; image: string
}
type Ligne = LigneUI & { quantite: number }

const MAX_PAR_LIGNE = 20

type Panier = {
  lignes: Ligne[]
  ajouter: (ligne: LigneUI, quantite: number) => void
  changerQuantite: (variantId: string, quantite: number) => void
  retirer: (variantId: string) => void
  vider: () => void
}

export const usePanier = create<Panier>()(
  persist(
    (set) => ({
      lignes: [],
      ajouter: (ligne, quantite) => set((s) => {
        const existante = s.lignes.find((l) => l.variantId === ligne.variantId)
        if (existante) {
          return {
            lignes: s.lignes.map((l) => l.variantId === ligne.variantId
              ? { ...l, quantite: Math.min(MAX_PAR_LIGNE, l.quantite + quantite) }
              : l),
          }
        }
        return { lignes: [...s.lignes, { ...ligne, quantite: Math.min(MAX_PAR_LIGNE, quantite) }] }
      }),
      changerQuantite: (variantId, quantite) => set((s) => {
        if (quantite <= 0) return { lignes: s.lignes.filter((l) => l.variantId !== variantId) }
        return {
          lignes: s.lignes.map((l) => l.variantId === variantId
            ? { ...l, quantite: Math.min(MAX_PAR_LIGNE, quantite) } : l),
        }
      }),
      retirer: (variantId) => set((s) => ({
        lignes: s.lignes.filter((l) => l.variantId !== variantId),
      })),
      vider: () => set({ lignes: [] }),
    }),
    { name: 'sc-panier-v1' },
  ),
)
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/lib/cart-store.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: panier persistant et tiroir latéral"
```

---

### Task 17: Interface de paiement et implémentations locales

**Files:**
- Create: `src/payments/provider.ts`, `src/payments/manual.ts`, `src/payments/fake.ts`, `src/payments/registry.ts`
- Test: `tests/payments/registry.test.ts`

**Interfaces:**
- Produit :
  ```ts
  type PaymentEvent = { reference: string; statut: 'reussi' | 'echoue'; montant: number }
  type PaymentStatus = 'en_attente' | 'reussi' | 'echoue'
  interface PaymentProvider {
    id: string
    initiate(order: { id: string; reference: string; total: number }, idempotencyKey: string): Promise<{ redirectUrl?: string; reference: string }>
    handleWebhook(req: Request): Promise<PaymentEvent>
    verify(reference: string): Promise<PaymentStatus>
  }
  getProvider(id: string): PaymentProvider   // lève si inconnu ou désactivé
  ```

- [ ] **Step 1: Écrire le test qui échoue**

`tests/payments/registry.test.ts` :

```ts
import { describe, it, expect, vi } from 'vitest'
import { getProvider } from '@/payments/registry'

describe('registre des fournisseurs de paiement', () => {
  it('retourne le fournisseur manuel', () => {
    expect(getProvider('manual').id).toBe('manual')
  })
  it('lève pour un fournisseur inconnu', () => {
    expect(() => getProvider('bitcoin')).toThrow(/inconnu/i)
  })
  it('refuse Orange Money tant que le réglage est désactivé', () => {
    vi.stubEnv('ORANGE_MONEY_ACTIF', 'false')
    expect(() => getProvider('orange_money')).toThrow(/indisponible/i)
    vi.unstubAllEnvs()
  })
  it('le fournisseur manuel ne redirige nulle part', async () => {
    const r = await getProvider('manual').initiate(
      { id: 'o1', reference: 'SC-1', total: 45000 }, 'cle-1')
    expect(r.redirectUrl).toBeUndefined()
    expect(r.reference).toBe('SC-1')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/payments/registry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/payments/provider.ts` :

```ts
export type PaymentStatus = 'en_attente' | 'reussi' | 'echoue'
export type PaymentEvent = { reference: string; statut: 'reussi' | 'echoue'; montant: number }

export type CommandeAPayer = { id: string; reference: string; total: number }

export interface PaymentProvider {
  id: string
  initiate(order: CommandeAPayer, idempotencyKey: string): Promise<{
    redirectUrl?: string; reference: string
  }>
  handleWebhook(req: Request): Promise<PaymentEvent>
  verify(reference: string): Promise<PaymentStatus>
}
```

`src/payments/manual.ts` :

```ts
import type { PaymentProvider } from './provider'

/** Paiement à la livraison ou au retrait : rien à encaisser en ligne. */
export const manualProvider: PaymentProvider = {
  id: 'manual',
  async initiate(order) {
    return { reference: order.reference }
  },
  async handleWebhook() {
    throw new Error('Le fournisseur manuel ne reçoit pas de webhook')
  },
  async verify() {
    return 'en_attente'
  },
}
```

`src/payments/registry.ts` :

```ts
import type { PaymentProvider } from './provider'
import { manualProvider } from './manual'
import { fakeProvider } from './fake'
import { orangeMoneyProvider } from './orange-money'

export function getProvider(id: string): PaymentProvider {
  switch (id) {
    case 'manual':
      return manualProvider
    case 'fake':
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Le fournisseur factice est interdit en production')
      }
      return fakeProvider
    case 'orange_money':
      if (process.env.ORANGE_MONEY_ACTIF !== 'true') {
        throw new Error('Orange Money est temporairement indisponible')
      }
      return orangeMoneyProvider
    default:
      throw new Error(`Fournisseur de paiement inconnu : ${id}`)
  }
}
```

`src/payments/fake.ts` — utilisé en développement et par les tests de bout en bout, il rejoue le parcours d'un opérateur sans réseau :

```ts
import type { PaymentProvider } from './provider'

export const fakeProvider: PaymentProvider = {
  id: 'fake',
  async initiate(order) {
    return {
      redirectUrl: `/commande/simulation?ref=${encodeURIComponent(order.reference)}`,
      reference: order.reference,
    }
  },
  async handleWebhook(req) {
    const corps = (await req.json()) as { reference: string; statut: string; montant?: number }
    return {
      reference: corps.reference,
      statut: corps.statut === 'SUCCESS' ? 'reussi' : 'echoue',
      montant: corps.montant ?? 0,
    }
  },
  async verify() {
    return 'reussi'
  },
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/payments/registry.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/payments tests/payments
git commit -m "feat: interface PaymentProvider et fournisseurs manuel et factice"
```

---

### Task 18: Tunnel de commande et canal WhatsApp

**Files:**
- Create: `src/app/(boutique)/commande/page.tsx`, `src/app/(boutique)/commande/actions.ts`
- Create: `src/lib/whatsapp.ts`
- Test: `tests/lib/whatsapp.test.ts`, `e2e/commande.spec.ts`

**Interfaces:**
- Consomme : `creerCommande`, `getProvider`, `usePanier`.
- Produit : `lienWhatsApp(numero: string, commande: { reference, lignes, total }): string`, action serveur `passerCommande(input)`.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/lib/whatsapp.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { lienWhatsApp } from '@/lib/whatsapp'

const commande = {
  reference: 'SC-AB12',
  lignes: [{ nom: 'Collier Vahiné — 45 cm', quantite: 2, prixUnitaire: 45000 }],
  total: 95000,
}

describe('lienWhatsApp', () => {
  it('normalise un numéro malgache au format international', () => {
    expect(lienWhatsApp('032 46 182 90', commande)).toContain('https://wa.me/261324618290')
  })
  it('accepte un numéro déjà au format international', () => {
    expect(lienWhatsApp('+261324618290', commande)).toContain('wa.me/261324618290')
  })
  it('encode le message avec la référence et le total', () => {
    const url = lienWhatsApp('0324618290', commande)
    const message = decodeURIComponent(new URL(url).searchParams.get('text')!)
    expect(message).toContain('SC-AB12')
    expect(message).toContain('95\u00A0000\u00A0Ar')
    expect(message).toContain('Collier Vahiné — 45 cm')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/lib/whatsapp.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/lib/whatsapp.ts` :

```ts
import { formatAriary } from '@/domain/money'

/** Convertit un numéro malgache local (0XX…) en format international sans le +. */
function normaliser(numero: string): string {
  const chiffres = numero.replace(/\D/g, '')
  if (chiffres.startsWith('261')) return chiffres
  if (chiffres.startsWith('0')) return `261${chiffres.slice(1)}`
  return chiffres
}

export function lienWhatsApp(numero: string, commande: {
  reference: string
  lignes: { nom: string; quantite: number; prixUnitaire: number }[]
  total: number
}): string {
  const articles = commande.lignes
    .map((l) => `• ${l.nom} × ${l.quantite} — ${formatAriary(l.prixUnitaire * l.quantite)}`)
    .join('\n')

  const message = [
    `Bonjour Summer Club, je souhaite confirmer ma commande ${commande.reference}.`,
    '', articles, '',
    `Total : ${formatAriary(commande.total)}`,
  ].join('\n')

  return `https://wa.me/${normaliser(numero)}?text=${encodeURIComponent(message)}`
}
```

- [ ] **Step 4: Écrire l'action serveur du tunnel**

`src/app/(boutique)/commande/actions.ts` :

```ts
'use server'

import { z } from 'zod'
import { creerCommande } from '@/server/orders'
import { getProvider } from '@/payments/registry'
import { prisma } from '@/server/db'

const commandeSchema = z.object({
  lignes: z.array(z.object({
    variantId: z.string().min(1),
    quantite: z.number().int().min(1).max(20),
  })).min(1, 'Votre panier est vide'),
  canal: z.enum(['orange_money', 'whatsapp', 'livraison']),
  nom: z.string().min(2, 'Indiquez votre nom'),
  tel: z.string().regex(/^(\+261|0)\d{9}$/, 'Numéro malgache invalide'),
  email: z.string().email('Adresse e-mail invalide').optional().or(z.literal('')),
  zoneId: z.string().nullable(),
  adresse: z.string().optional(),
})

export async function passerCommande(donnees: unknown) {
  const v = commandeSchema.parse(donnees)

  // Les prix ne viennent jamais du client : creerCommande les recalcule.
  const commande = await creerCommande({
    lignes: v.lignes, canal: v.canal,
    client: { nom: v.nom, tel: v.tel, email: v.email || undefined, adresse: v.adresse },
    zoneId: v.zoneId, estMembre: false,
  })

  if (v.canal === 'orange_money') {
    const provider = getProvider('orange_money')
    const cle = `${commande.id}:1`
    const { redirectUrl, reference } = await provider.initiate(
      { id: commande.id, reference: commande.reference, total: commande.total }, cle)

    await prisma.payment.create({
      data: {
        orderId: commande.id, provider: 'orange_money', montant: commande.total,
        statut: 'en_attente', refExterne: reference, idempotencyKey: cle,
      },
    })
    return { ...commande, redirectUrl }
  }

  return { ...commande, redirectUrl: undefined }
}
```

- [ ] **Step 5: Écrire le test de bout en bout**

`e2e/commande.spec.ts` :

```ts
import { test, expect } from '@playwright/test'

test('commande complète en paiement à la livraison', async ({ page }) => {
  await page.goto('/boutique')
  await page.getByRole('link', { name: /Collier Vahiné/ }).click()
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.goto('/commande')

  await page.getByLabel('Nom').fill('Hasina R.')
  await page.getByLabel('Téléphone').fill('0324618290')
  await page.getByLabel('Zone de livraison').selectOption({ label: 'Antananarivo centre' })
  await page.getByLabel('Adresse').fill('Analakely, lot II')
  await page.getByRole('radio', { name: /à la livraison/i }).check()
  await page.getByRole('button', { name: 'Valider ma commande' }).click()

  await expect(page).toHaveURL(/\/commande\/merci/)
  await expect(page.getByText(/SC-/)).toBeVisible()
})

test('le tunnel refuse un numéro invalide', async ({ page }) => {
  await page.goto('/commande')
  await page.getByLabel('Téléphone').fill('12345')
  await page.getByRole('button', { name: 'Valider ma commande' }).click()
  await expect(page.getByText('Numéro malgache invalide')).toBeVisible()
})
```

- [ ] **Step 6: Lancer les tests**

Run: `npm test -- tests/lib/whatsapp.test.ts` puis `npx playwright test e2e/commande.spec.ts`
Expected: 3 + 2 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: tunnel de commande trois canaux et lien WhatsApp pré-rempli"
```

---

### Task 19: Orange Money — webhook, idempotence et signature

**Files:**
- Create: `src/payments/orange-money.ts`, `src/app/api/paiement/[provider]/webhook/route.ts`
- Test: `tests/payments/webhook.test.ts`

**Interfaces:**
- Consomme : `getProvider`, `changerStatut`.
- Produit : route `POST /api/paiement/orange_money/webhook`.

**Dépendance externe :** les points d'entrée exacts, le format de charge utile et le schéma de signature d'Orange Money Madagascar ne seront connus qu'à réception du contrat marchand. L'implémentation ci-dessous isole cette incertitude dans deux fonctions — `verifierSignature` et `lireEvenement` — qui seront les seules à ajuster. Toute la logique de sécurité et d'idempotence est testable dès maintenant.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/payments/webhook.test.ts` :

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { prisma } from '@/server/db'
import { creerCommande } from '@/server/orders'
import { POST } from '@/app/api/paiement/[provider]/webhook/route'

const SECRET = 'secret-de-test'
vi.stubEnv('ORANGE_MONEY_WEBHOOK_SECRET', SECRET)
vi.stubEnv('ORANGE_MONEY_ACTIF', 'true')

function requete(corps: object, signature?: string) {
  const body = JSON.stringify(corps)
  const sig = signature ?? createHmac('sha256', SECRET).update(body).digest('hex')
  return new Request('http://localhost/api/paiement/orange_money/webhook', {
    method: 'POST', body, headers: { 'x-signature': sig, 'content-type': 'application/json' },
  })
}

const params = Promise.resolve({ provider: 'orange_money' })
let variantId: string

beforeEach(async () => {
  await prisma.payment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  const v = await prisma.variant.findUniqueOrThrow({ where: { sku: 'VAH-45' } })
  await prisma.variant.update({ where: { id: v.id }, data: { stock: 10 } })
  variantId = v.id
})

afterAll(() => prisma.$disconnect())

async function commandeEnAttente() {
  return creerCommande({
    lignes: [{ variantId, quantite: 1 }], canal: 'orange_money',
    client: { nom: 'T', tel: '0320000000' }, zoneId: null, estMembre: false,
  })
}

describe('webhook Orange Money', () => {
  it('rejette une signature invalide', async () => {
    const c = await commandeEnAttente()
    const res = await POST(requete({ reference: c.reference, statut: 'SUCCESS' }, 'fausse'),
      { params })
    expect(res.status).toBe(401)
  })

  it('confirme la commande et décrémente le stock sur un paiement réussi', async () => {
    const c = await commandeEnAttente()
    const res = await POST(requete({ reference: c.reference, statut: 'SUCCESS' }), { params })
    expect(res.status).toBe(200)
    const maj = await prisma.order.findUniqueOrThrow({ where: { id: c.id } })
    expect(maj.statut).toBe('confirmee')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(9)
  })

  it('est idempotent : un webhook rejoué ne décrémente pas deux fois', async () => {
    const c = await commandeEnAttente()
    await POST(requete({ reference: c.reference, statut: 'SUCCESS' }), { params })
    const res2 = await POST(requete({ reference: c.reference, statut: 'SUCCESS' }), { params })
    expect(res2.status).toBe(200)
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(9)
  })

  it('passe la commande en échec sur un paiement refusé, sans toucher au stock', async () => {
    const c = await commandeEnAttente()
    await POST(requete({ reference: c.reference, statut: 'FAILED' }), { params })
    const maj = await prisma.order.findUniqueOrThrow({ where: { id: c.id } })
    expect(maj.statut).toBe('echec_paiement')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })

  it('ignore une référence de commande inconnue sans révéler d\'information', async () => {
    const res = await POST(requete({ reference: 'SC-INEXISTANT', statut: 'SUCCESS' }), { params })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/payments/webhook.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter le fournisseur**

`src/payments/orange-money.ts` :

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PaymentProvider, PaymentEvent, PaymentStatus } from './provider'

const BASE = process.env.ORANGE_MONEY_BASE_URL ?? ''
const SECRET = () => process.env.ORANGE_MONEY_WEBHOOK_SECRET ?? ''

/**
 * Comparaison à temps constant : une comparaison naïve laisse fuir
 * la signature attendue octet par octet.
 */
export function verifierSignature(corps: string, signature: string | null): boolean {
  if (!signature) return false
  const attendue = createHmac('sha256', SECRET()).update(corps).digest('hex')
  const a = Buffer.from(attendue, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Traduit la charge utile de l'opérateur vers notre modèle interne. */
export function lireEvenement(payload: Record<string, unknown>): PaymentEvent {
  const statut = String(payload.statut ?? payload.status ?? '').toUpperCase()
  return {
    reference: String(payload.reference ?? payload.order_id ?? ''),
    statut: statut === 'SUCCESS' || statut === 'SUCCESSFUL' ? 'reussi' : 'echoue',
    montant: Number(payload.amount ?? 0),
  }
}

export const orangeMoneyProvider: PaymentProvider = {
  id: 'orange_money',

  async initiate(order, idempotencyKey) {
    const res = await fetch(`${BASE}/webpayment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ORANGE_MONEY_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        merchant_key: process.env.ORANGE_MONEY_MERCHANT_KEY,
        currency: 'MGA',
        order_id: order.reference,
        amount: order.total,
        return_url: `${process.env.SITE_URL}/commande/merci?ref=${order.reference}`,
        cancel_url: `${process.env.SITE_URL}/panier`,
        notif_url: `${process.env.SITE_URL}/api/paiement/orange_money/webhook`,
      }),
    })
    if (!res.ok) throw new Error(`Orange Money a refusé la demande (${res.status})`)
    const data = (await res.json()) as { payment_url: string }
    return { redirectUrl: data.payment_url, reference: order.reference }
  },

  async handleWebhook(req) {
    const corps = await req.text()
    if (!verifierSignature(corps, req.headers.get('x-signature'))) {
      throw new Error('Signature invalide')
    }
    return lireEvenement(JSON.parse(corps) as Record<string, unknown>)
  },

  async verify(reference): Promise<PaymentStatus> {
    const res = await fetch(`${BASE}/webpayment/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.ORANGE_MONEY_TOKEN}` },
    })
    if (!res.ok) return 'en_attente'
    const data = (await res.json()) as { status: string }
    return data.status === 'SUCCESS' ? 'reussi' : 'echoue'
  },
}
```

- [ ] **Step 4: Implémenter la route**

`src/app/api/paiement/[provider]/webhook/route.ts` :

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { getProvider } from '@/payments/registry'
import { appliquerStatut } from '@/server/order-status-service'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: id } = await params

  let evenement
  try {
    evenement = await getProvider(id).handleWebhook(req)
  } catch {
    // Signature invalide ou fournisseur désactivé : aucune information rendue.
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const commande = await prisma.order.findUnique({
    where: { reference: evenement.reference },
    include: { payments: true },
  })
  // Référence inconnue : on répond 200 pour ne pas confirmer son inexistence
  // et pour éviter que l'opérateur ne rejoue indéfiniment.
  if (!commande) return NextResponse.json({ ok: true })

  const dejaTraite = commande.payments.some(
    (p) => p.provider === id && p.statut !== 'en_attente',
  )
  if (dejaTraite) return NextResponse.json({ ok: true })

  await prisma.payment.updateMany({
    where: { orderId: commande.id, provider: id, statut: 'en_attente' },
    data: { statut: evenement.statut, payloadBrut: evenement as never },
  })

  await appliquerStatut(
    commande.id,
    evenement.statut === 'reussi' ? 'confirmee' : 'echec_paiement',
    `webhook:${id}`,
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/payments/webhook.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: fournisseur Orange Money avec webhook signé et idempotent"
```

---

### Task 20: Suivi de commande et dépôt d'avis vérifié

**Files:**
- Create: `src/app/(boutique)/suivi/[token]/page.tsx`, `src/app/(boutique)/suivi/actions.ts`
- Test: `tests/server/reviews.test.ts`

**Interfaces:**
- Produit : `deposerAvis(token: string, input: { note: number; texte: string; auteur: string })` — n'accepte que les commandes en statut `livree`, une seule fois par commande.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/server/reviews.test.ts` :

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/server/db'
import { creerCommande } from '@/server/orders'
import { deposerAvis } from '@/app/(boutique)/suivi/actions'

let variantId: string

beforeEach(async () => {
  await prisma.review.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  const v = await prisma.variant.findUniqueOrThrow({ where: { sku: 'VAH-45' } })
  await prisma.variant.update({ where: { id: v.id }, data: { stock: 10 } })
  variantId = v.id
})

afterAll(() => prisma.$disconnect())

async function commandeLivree() {
  const c = await creerCommande({
    lignes: [{ variantId, quantite: 1 }], canal: 'livraison',
    client: { nom: 'T', tel: '0320000000' }, zoneId: null, estMembre: false,
  })
  await prisma.order.update({ where: { id: c.id }, data: { statut: 'livree' } })
  return c
}

const avis = { note: 5, texte: 'Magnifique, ne ternit pas.', auteur: 'Hasina' }

describe('deposerAvis', () => {
  it('accepte un avis sur une commande livrée et le marque comme vérifié', async () => {
    const c = await commandeLivree()
    const r = await deposerAvis(c.tokenSuivi, avis)
    expect(r.source).toBe('verifie')
  })

  it('refuse un token inconnu', async () => {
    await expect(deposerAvis('token-bidon', avis)).rejects.toThrow(/introuvable/i)
  })

  it('refuse un avis sur une commande non livrée', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 1 }], canal: 'livraison',
      client: { nom: 'T', tel: '0320000000' }, zoneId: null, estMembre: false,
    })
    await expect(deposerAvis(c.tokenSuivi, avis)).rejects.toThrow(/livrée/i)
  })

  it('refuse un second avis sur la même commande', async () => {
    const c = await commandeLivree()
    await deposerAvis(c.tokenSuivi, avis)
    await expect(deposerAvis(c.tokenSuivi, avis)).rejects.toThrow(/déjà/i)
  })

  it('refuse une note hors de l\'échelle 1 à 5', async () => {
    const c = await commandeLivree()
    await expect(deposerAvis(c.tokenSuivi, { ...avis, note: 9 })).rejects.toThrow()
  })

  it('place l\'avis en attente de modération', async () => {
    const c = await commandeLivree()
    const r = await deposerAvis(c.tokenSuivi, avis)
    expect(r.statut).toBe('en_attente')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/server/reviews.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/app/(boutique)/suivi/actions.ts` :

```ts
'use server'

import { z } from 'zod'
import { prisma } from '@/server/db'

const avisSchema = z.object({
  note: z.number().int().min(1).max(5),
  texte: z.string().min(5, 'Dites-nous en un peu plus').max(1000),
  auteur: z.string().min(1, 'Indiquez votre prénom').max(60),
})

export async function deposerAvis(token: string, donnees: unknown) {
  const valide = avisSchema.parse(donnees)

  const commande = await prisma.order.findUnique({
    where: { tokenSuivi: token },
    include: { items: { include: { variant: true } }, reviews: true },
  })
  if (!commande) throw new Error('Commande introuvable')
  if (commande.statut !== 'livree') {
    throw new Error('Un avis ne peut être déposé qu\'une fois la commande livrée')
  }
  if (commande.reviews.length > 0) {
    throw new Error('Un avis a déjà été déposé pour cette commande')
  }

  return prisma.review.create({
    data: {
      ...valide,
      productId: commande.items[0]?.variant.productId ?? null,
      orderId: commande.id,
      source: 'verifie',
      statut: 'en_attente',
    },
  })
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/server/reviews.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: page de suivi de commande et dépôt d'avis vérifié"
```

---

# Phase 6 — Mise en ligne

### Task 21: SEO technique

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx`
- Test: `tests/seo.test.ts`

**Interfaces:**
- Produit : `sitemap()` listant l'accueil, la boutique et les produits actifs.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/seo.test.ts` :

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/server/db'
import sitemap from '@/app/sitemap'

afterAll(() => prisma.$disconnect())

describe('sitemap', () => {
  it('contient l\'accueil et la boutique', async () => {
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.some((u) => u.endsWith('/'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/boutique'))).toBe(true)
  })

  it('liste les produits actifs', async () => {
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.some((u) => u.includes('/boutique/collier-vahine'))).toBe(true)
  })

  it('exclut les produits inactifs', async () => {
    const p = await prisma.product.findFirstOrThrow({ where: { slug: 'collier-vahine' } })
    await prisma.product.update({ where: { id: p.id }, data: { actif: false } })
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.some((u) => u.includes('collier-vahine'))).toBe(false)
    await prisma.product.update({ where: { id: p.id }, data: { actif: true } })
  })

  it('n\'expose jamais le back-office', async () => {
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.some((u) => u.includes('/admin'))).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- tests/seo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`src/app/sitemap.ts` :

```ts
import type { MetadataRoute } from 'next'
import { prisma } from '@/server/db'

const SITE = process.env.SITE_URL ?? 'https://summerclub.mg'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const produits = await prisma.product.findMany({
    where: { actif: true }, select: { slug: true, updatedAt: true },
  })

  return [
    { url: `${SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/boutique`, changeFrequency: 'daily', priority: 0.9 },
    ...produits.map((p) => ({
      url: `${SITE}/boutique/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
```

`src/app/robots.ts` :

```ts
import type { MetadataRoute } from 'next'

const SITE = process.env.SITE_URL ?? 'https://summerclub.mg'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/suivi'] }],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- tests/seo.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: sitemap, robots et image Open Graph"
```

---

### Task 22: Déploiement, sauvegardes et restauration vérifiée

**Files:**
- Create: `docker/compose.prod.yml`, `docker/Caddyfile`, `Dockerfile`, `docker/backup.sh`, `docs/exploitation.md`
- Test: exécution manuelle documentée dans `docs/exploitation.md`

**Interfaces:**
- Produit : `docker compose -f docker/compose.prod.yml up -d` démarre le site complet ; `docker/backup.sh` produit une archive restaurable.

- [ ] **Step 1: Écrire le Dockerfile**

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json prisma ./
RUN npm ci && npx prisma generate

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Écrire le Caddyfile avec les en-têtes de sécurité**

`docker/Caddyfile` :

```
summerclub.mg {
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'"
    -Server
  }
  @statique path /uploads/* /_next/static/*
  header @statique Cache-Control "public, max-age=31536000, immutable"
  reverse_proxy app:3000
}
```

- [ ] **Step 3: Écrire le script de sauvegarde**

`docker/backup.sh` :

```bash
#!/bin/sh
set -eu

HORODATAGE=$(date +%Y%m%d-%H%M)
DESTINATION=/sauvegardes

pg_dump -h db -U summerclub summerclub | gzip > "$DESTINATION/db-$HORODATAGE.sql.gz"
tar czf "$DESTINATION/uploads-$HORODATAGE.tar.gz" -C /app/public uploads

rclone copy "$DESTINATION" "r2:summerclub-sauvegardes" --max-age 25h

# Rétention : 7 quotidiennes, 4 hebdomadaires
find "$DESTINATION" -name 'db-*' -mtime +7 -delete
find "$DESTINATION" -name 'uploads-*' -mtime +7 -delete
```

- [ ] **Step 4: Exécuter et documenter une restauration réelle**

C'est un critère d'acceptation de la V1.0, pas une formalité : une sauvegarde jamais restaurée n'est pas une sauvegarde.

```bash
docker compose -f docker/compose.prod.yml exec db \
  psql -U summerclub -c "CREATE DATABASE restauration_test;"
gunzip -c sauvegardes/db-*.sql.gz | \
  docker compose -f docker/compose.prod.yml exec -T db psql -U summerclub restauration_test
docker compose -f docker/compose.prod.yml exec db \
  psql -U summerclub restauration_test -c "SELECT count(*) FROM \"Product\";"
```

Expected: le compte de produits correspond à celui de la base de production.

Consigner dans `docs/exploitation.md` : la date de l'essai, le compte obtenu, la durée totale, et la procédure exacte à rejouer.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: déploiement Docker, en-têtes de sécurité, sauvegardes et procédure de restauration"
```

---

### Task 23: Parcours de bout en bout complet et budget de performance

**Files:**
- Create: `e2e/parcours-complet.spec.ts`, `e2e/performance.spec.ts`
- Modify: `package.json` (script `verify`)

- [ ] **Step 1: Écrire le parcours des trois canaux**

`e2e/parcours-complet.spec.ts` :

```ts
import { test, expect } from '@playwright/test'

const canaux = [
  { nom: 'à la livraison', urlAttendue: /\/commande\/merci/ },
  { nom: 'WhatsApp', urlAttendue: /\/commande\/merci/ },
  { nom: 'Orange Money', urlAttendue: /simulation|merci/ },
]

for (const canal of canaux) {
  test(`parcours complet — ${canal.nom}`, async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /la boutique/i }).first().click()
    await page.getByRole('link', { name: /Collier Vahiné/ }).click()
    await page.getByRole('button', { name: 'Ajouter au panier' }).click()
    await page.getByRole('link', { name: /panier/i }).click()
    await page.getByRole('link', { name: /commander/i }).click()

    await page.getByLabel('Nom').fill('Hasina R.')
    await page.getByLabel('Téléphone').fill('0324618290')
    await page.getByLabel('Zone de livraison').selectOption({ index: 1 })
    await page.getByLabel('Adresse').fill('Analakely, lot II')
    await page.getByRole('radio', { name: new RegExp(canal.nom, 'i') }).check()
    await page.getByRole('button', { name: 'Valider ma commande' }).click()

    await expect(page).toHaveURL(canal.urlAttendue)
  })
}

test('le stock affiché diminue après une commande', async ({ page, request }) => {
  const avant = await (await request.get('/api/test/stock?sku=VAH-45')).json()
  await page.goto('/boutique/collier-vahine')
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  // …parcours abrégé, canal livraison…
  const apres = await (await request.get('/api/test/stock?sku=VAH-45')).json()
  expect(apres.stock).toBe(avant.stock - 1)
})
```

La route `/api/test/stock` n'est montée qu'hors production, gardée par `if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 })`.

- [ ] **Step 2: Écrire le contrôle du budget de performance**

`e2e/performance.spec.ts` :

```ts
import { test, expect } from '@playwright/test'

test.describe('budget de performance', () => {
  test('la page d\'accueil pèse moins de 250 Ko hors images', async ({ page }) => {
    let octets = 0
    page.on('response', async (r) => {
      const type = r.headers()['content-type'] ?? ''
      if (/javascript|css|html|font/.test(type)) {
        octets += Number(r.headers()['content-length'] ?? 0)
      }
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    expect(octets).toBeLessThan(250 * 1024)
  })

  test('toutes les images produit portent un texte alternatif', async ({ page }) => {
    await page.goto('/boutique')
    const sansAlt = await page.locator('img:not([alt])').count()
    expect(sansAlt).toBe(0)
  })

  test('la navigation au clavier atteint le premier produit', async ({ page }) => {
    await page.goto('/boutique')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => document.activeElement?.tagName)
    expect(['A', 'BUTTON']).toContain(focus)
  })
})
```

- [ ] **Step 3: Ajouter le script de vérification globale**

Dans `package.json` :

```json
"scripts": {
  "verify": "tsc --noEmit && npm run test && npx playwright test"
}
```

- [ ] **Step 4: Lancer la vérification complète**

Run: `npm run verify`
Expected: aucune erreur TypeScript, tous les tests Vitest verts, tous les parcours Playwright verts.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: parcours de bout en bout des trois canaux et budget de performance"
```

---

## Suivi de la couverture du plan

| Exigence de la spec | Tâche |
|---|---|
| §3 Charte, contrastes, arche, mouvement | 1, 13 |
| §3.9 Guide de prise de vue | 11 |
| §4 Stack, déploiement, budget de perf | 1, 2, 22, 23 |
| §4.4 Sauvegardes et restauration testée | 22 |
| §5 Modèle de données, prix entiers, figement | 2, 7 |
| §6.1 Promotions, happy hour, non-cumul, fuseau | 4 |
| §6.2 Statuts et effets sur le stock | 6, 12 |
| §6.3 Stock, transaction, non-survente | 2, 7 |
| §7.1 Trois canaux | 18 |
| §7.2 Interface PaymentProvider | 17 |
| §7.3 Orange Money | 19 |
| §7.4 Idempotence, signature, webhook seul juge | 19 |
| §7.5 Suivi par token | 20 |
| §8 Page d'accueil, cinq sections | 15 |
| §9 Back-office piloté par schéma | 10, 11, 12 |
| §10 SEO, JSON-LD, sitemap, robots | 14, 21 |
| §11 Sécurité, en-têtes, téléversements, audit | 10, 11, 19, 22 |
| §12 Tests unitaires et de bout en bout | 3–8, 23 |
| §14 Critères d'acceptation | 23 |
