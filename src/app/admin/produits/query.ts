import type { Prisma } from '@prisma/client'

// Taille de page volontairement modeste : c'est un catalogue de boutique artisanale, pas
// une marketplace — 20 produits par page tient sur un écran sans défilement excessif.
export const PRODUCTS_PER_PAGE = 20

export type ProductFilters = {
  categoryId?: string
  active?: boolean
}

// Ligne telle qu'affichée par AdminTable : `categoryId` y porte le NOM de la catégorie,
// pas son identifiant technique. AdminTable est un composant de présentation générique qui
// affiche tel quel ce qu'on lui donne — remplacer ici la valeur affichée sous cette colonne
// est une décision d'écran, prise à la frontière entre la base et l'UI ; le nom du champ
// reste `categoryId` pour correspondre à `productsResource.columns`.
//
// ⚠ `nom`/`prixBase`/`prixAchat`/`actif`/`ordre` gardent leur nom français : cette ligne est
// passée telle quelle en `rows` à <AdminTable resource={productsResource} ...>, dont le
// paramètre générique T est lié à `ProductInput` (src/admin/resources/products.ts,
// `productSchema`, miroir des colonnes Prisma pas encore renommées — étape 6). Renommer ces
// champs romprait l'assignabilité structurelle à la compilation ; même frontière que
// `Media.chemin` en § 3.7 (couche src/server/) et qu'`OrderListRow` ci-contre
// (src/app/admin/commandes/query.ts).
export type ProductListRow = {
  id: string
  nom: string
  slug: string
  description: string
  categoryId: string
  prixBase: number
  prixAchat: number
  actif: boolean
  // Pas affiché en colonne (productsResource.columns ne le liste pas) : présent ici
  // uniquement pour que ce type reste structurellement compatible avec `ProductInput`
  // (productSchema, désormais porteur de `ordre` — voir resources/products.ts), que
  // <AdminTable> exige de sa prop `rows`.
  ordre: number
}

// Sous-ensemble du delegate Prisma dont cette fonction a besoin — même esprit que
// `DelegatePrisma` dans src/admin/engine/actions.ts : découpler la logique de pagination
// du client Prisma réel permet de l'exercer en test avec un espion (vi.spyOn) sans jamais
// charger tout le catalogue en mémoire pour vérifier qu'on ne le fait pas.
export type ProductListDelegate = {
  count: (args: { where: Prisma.ProductWhereInput }) => Promise<number>
  findMany: (args: {
    where: Prisma.ProductWhereInput
    orderBy: Prisma.ProductOrderByWithRelationInput[]
    skip: number
    take: number
    include: { category: true }
  }) => Promise<Array<Prisma.ProductGetPayload<{ include: { category: true } }>>>
}

// La vraie requête paginée : `skip`/`take` et le comptage sont calculés puis transmis à
// Prisma, qui filtre et découpe côté base de données. Aucune ligne au-delà de la page
// demandée n'est jamais chargée en mémoire Node.
export async function listProductsPaginated(
  delegate: ProductListDelegate,
  params: { page: number; filters?: ProductFilters },
): Promise<{ rows: ProductListRow[]; page: number; totalPages: number }> {
  const where: Prisma.ProductWhereInput = {}
  if (params.filters?.categoryId) where.categoryId = params.filters.categoryId
  if (params.filters?.active !== undefined) where.actif = params.filters.active

  const total = await delegate.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE))
  const page = Math.min(Math.max(1, Math.trunc(params.page) || 1), totalPages)

  // `ordre` vaut 0 par défaut pour tout produit créé depuis l'interface (voir
  // resources/products.ts) : trier sur ce seul critère laisse une clé intégralement
  // constante entre plusieurs produits, et PostgreSQL ne garantit alors aucun ordre stable
  // d'une requête à l'autre — skip/take peut renvoyer deux fois la même ligne sur deux
  // pages, et en oublier une autre. `id` (unique) en second critère rend le tri
  // déterministe sans changer l'ordre voulu par la propriétaire tant que `ordre` diffère.
  const products = await delegate.findMany({
    where,
    orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
    skip: (page - 1) * PRODUCTS_PER_PAGE,
    take: PRODUCTS_PER_PAGE,
    include: { category: true },
  })

  const rows: ProductListRow[] = products.map((p) => ({
    id: p.id,
    nom: p.nom,
    slug: p.slug,
    description: p.description,
    categoryId: p.category.nom,
    prixBase: p.prixBase,
    prixAchat: p.prixAchat,
    actif: p.actif,
    ordre: p.ordre,
  }))

  return { rows, page, totalPages }
}
