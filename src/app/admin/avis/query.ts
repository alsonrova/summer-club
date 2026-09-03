import type { Prisma, ReviewSource, ReviewStatus } from '@prisma/client'

export const REVIEWS_PER_PAGE = 20

export const REVIEW_STATUSES = ['pending', 'published', 'rejected'] as const satisfies readonly ReviewStatus[]

/**
 * Les deux statuts qu'une décision de modération peut écrire. `pending` n'en est pas
 * une : c'est l'état d'ENTRÉE de la file, pas une décision qu'on y prend. Déclaré
 * `satisfies readonly ReviewStatus[]` pour qu'un renommage dans l'énumération Prisma casse
 * ici, à la compilation, plutôt qu'à l'exécution.
 */
export const MODERATION_STATUSES = ['published', 'rejected'] as const satisfies readonly ReviewStatus[]

export type ModerationStatus = (typeof MODERATION_STATUSES)[number]

/**
 * Vrai si la valeur est l'un des trois statuts d'avis — pour valider une valeur venue du
 * client. Pendant de `isOrderStatus` côté commandes (src/domain/order-status.ts) : une Server
 * Action exportée est une route publique, protégée par `requireAdmin()` mais pas typée à
 * l'exécution.
 */
export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === 'string' && (REVIEW_STATUSES as readonly string[]).includes(value)
}

/** Vrai si la valeur est une décision de modération recevable (`published` ou `rejected`). */
export function isModerationStatus(value: unknown): value is ModerationStatus {
  return isReviewStatus(value) && (MODERATION_STATUSES as readonly string[]).includes(value)
}

export const REVIEW_STATUS_LABELS = {
  pending: 'En attente',
  published: 'Publié',
  rejected: 'Rejeté',
} as const satisfies Record<ReviewStatus, string>

export const REVIEW_SOURCE_LABELS = {
  verified: 'Achat vérifié',
  imported: 'Importé',
} as const satisfies Record<ReviewSource, string>

export type ReviewFilters = {
  status?: ReviewStatus
  pinned?: boolean
}

export type ReviewListRow = {
  id: string
  author: string
  rating: number
  body: string
  source: ReviewSource
  status: ReviewStatus
  pinned: boolean
  createdAt: Date
  product: string | null
}

// Même motif que ProductListDelegate/OrderListDelegate : le sous-ensemble du
// delegate Prisma réellement utilisé, pour que la pagination soit vérifiable en test.
export type ReviewListDelegate = {
  count: (args: { where: Prisma.ReviewWhereInput }) => Promise<number>
  findMany: (args: {
    where: Prisma.ReviewWhereInput
    orderBy: Prisma.ReviewOrderByWithRelationInput[]
    skip: number
    take: number
    include: { product: { select: { name: true } } }
  }) => Promise<Prisma.ReviewGetPayload<{ include: { product: { select: { name: true } } } }>[]>
}

export async function listReviewsPaginated(
  delegate: ReviewListDelegate,
  params: { page: number; filters?: ReviewFilters },
): Promise<{ rows: ReviewListRow[]; page: number; totalPages: number; total: number }> {
  const where: Prisma.ReviewWhereInput = {}
  if (params.filters?.status) where.status = params.filters.status
  if (params.filters?.pinned !== undefined) where.pinned = params.filters.pinned

  const total = await delegate.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE))
  const page = Math.min(Math.max(1, Math.trunc(params.page) || 1), totalPages)

  // Les avis épinglés d'abord (c'est ce que la propriétaire vient vérifier), puis les plus
  // récents. `id` en dernier critère : sans clé unique finale, deux avis créés dans la même
  // milliseconde peuvent changer d'ordre entre deux requêtes, et skip/take dupliquer une
  // ligne d'une page à l'autre.
  const reviews = await delegate.findMany({
    where,
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * REVIEWS_PER_PAGE,
    take: REVIEWS_PER_PAGE,
    include: { product: { select: { name: true } } },
  })

  const rows: ReviewListRow[] = reviews.map((r) => ({
    id: r.id,
    author: r.author,
    rating: r.rating,
    body: r.body,
    source: r.source,
    status: r.status,
    pinned: r.pinned,
    createdAt: r.createdAt,
    product: r.product?.name ?? null,
  }))

  return { rows, page, totalPages, total }
}
