import type { Prisma } from '@prisma/client'
import type { OrderStatus } from '@/domain/order-status'
import type { CHANNELS } from '@/admin/resources/orders'

// Même taille de page que le catalogue : une boutique artisanale, pas une marketplace.
export const ORDERS_PER_PAGE = 20

export type Channel = (typeof CHANNELS)[number]

export type OrderFilters = {
  status?: OrderStatus
  channel?: Channel
  reference?: string
}

// Ligne telle qu'affichée par <AdminTable>. `id` n'est pas une colonne (il n'est pas dans
// `orderSchema`) mais il est nécessaire à la clé de rendu et au lien vers la fiche — même
// motif que ProductListRow.
//
// ⚠ `clientNom`/`tel`/`canal`/`statut` gardent leur nom français : cette ligne est passée
// telle quelle en `rows` à <AdminTable resource={ordersResource} ...>, dont le paramètre
// générique T est lié à `OrderListInput` (src/admin/resources/orders.ts, `orderSchema`,
// lui-même miroir des colonnes Prisma pas encore renommées — étape 6). Renommer ces quatre
// champs romprait l'assignabilité structurelle à la compilation ; c'est la même frontière
// que `Media.chemin` en § 3.7 (couche src/server/).
export type OrderListRow = {
  id: string
  reference: string
  createdAt: Date
  clientNom: string
  tel: string
  canal: Channel
  statut: OrderStatus
  total: number
}

// Sous-ensemble du delegate Prisma réellement utilisé — même esprit que
// ProductListDelegate : la pagination peut être exercée en test avec un espion, ce qui
// permet d'affirmer que skip/take partent bien vers la base au lieu de vérifier
// indirectement des lignes déjà découpées en mémoire.
export type OrderListDelegate = {
  count: (args: { where: Prisma.OrderWhereInput }) => Promise<number>
  findMany: (args: {
    where: Prisma.OrderWhereInput
    orderBy: Prisma.OrderOrderByWithRelationInput[]
    skip: number
    take: number
  }) => Promise<Prisma.OrderGetPayload<object>[]>
}

export async function listOrdersPaginated(
  delegate: OrderListDelegate,
  params: { page: number; filters?: OrderFilters },
): Promise<{ rows: OrderListRow[]; page: number; totalPages: number; total: number }> {
  const where: Prisma.OrderWhereInput = {}
  if (params.filters?.status) where.statut = params.filters.status
  if (params.filters?.channel) where.canal = params.filters.channel
  if (params.filters?.reference) {
    // `contains` insensible à la casse : la propriétaire recopie une référence lue sur
    // WhatsApp, souvent partiellement et sans respecter la casse.
    where.reference = { contains: params.filters.reference, mode: 'insensitive' }
  }

  const total = await delegate.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE))
  const page = Math.min(Math.max(1, Math.trunc(params.page) || 1), totalPages)

  // `createdAt` seul ne suffit PAS comme clé de tri : deux commandes passées dans la même
  // milliseconde (un test, une rafale) partagent la même valeur, et PostgreSQL ne garantit
  // alors aucun ordre stable d'une requête à l'autre — skip/take renverrait deux fois la
  // même ligne sur deux pages et en oublierait une autre. `id` (unique) en second critère
  // rend le tri total, donc déterministe.
  const orders = await delegate.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * ORDERS_PER_PAGE,
    take: ORDERS_PER_PAGE,
  })

  const rows: OrderListRow[] = orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    createdAt: o.createdAt,
    clientNom: o.clientNom,
    tel: o.tel,
    canal: o.canal,
    statut: o.statut,
    total: o.total,
  }))

  return { rows, page, totalPages, total }
}
