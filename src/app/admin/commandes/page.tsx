import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import { AdminTable } from '@/admin/engine/table'
import {
  ordersResource,
  CHANNELS,
  CHANNEL_LABELS,
  STATUS_LABELS,
  isChannel,
  channelLabel,
  statusLabel,
} from '@/admin/resources/orders'
import { formatAriary } from '@/domain/money'
import { ORDER_STATUSES, isOrderStatus } from '@/domain/order-status'
import { listOrdersPaginated } from './query'

function toValidPage(value: string | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1
}

function truncateText(value: unknown): string {
  const s = typeof value === 'string' ? value.trim() : ''
  return s.slice(0, 60)
}

const STATUS_OPTIONS = ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))
const CHANNEL_OPTIONS = CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))

// Chaque page d'administration appelle requireAdmin() elle-même : voir la convention dans
// src/server/auth.ts — le layout ne suffit pas.
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()

  const sp = await searchParams
  const rawStatus = typeof sp.statut === 'string' ? sp.statut : undefined
  const rawChannel = typeof sp.canal === 'string' ? sp.canal : undefined
  const rawReference = typeof sp.reference === 'string' ? sp.reference : undefined

  // La querystring est écrite par le visiteur : un statut ou un canal inconnu est ignoré
  // plutôt que transmis à Prisma, qui répondrait par une erreur d'énumération PostgreSQL.
  // Les deux passent par le même genre de garde de type, jamais par un `as`.
  const status = isOrderStatus(rawStatus) ? rawStatus : undefined
  const channel = isChannel(rawChannel) ? rawChannel : undefined
  const reference = truncateText(rawReference) || undefined
  const page = toValidPage(typeof sp.page === 'string' ? sp.page : undefined)

  const { rows, page: currentPage, totalPages, total } = await listOrdersPaginated(
    prisma.order,
    { page, filters: { status, channel, reference } },
  )

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-2xl font-light text-bark">Commandes</h1>
        <p className="text-small text-bark-soft tabular-nums">
          {total} commande{total > 1 ? 's' : ''}
        </p>
      </div>

      <AdminTable
        resource={ordersResource}
        rows={rows}
        basePath="/admin/commandes"
        page={currentPage}
        totalPages={totalPages}
        filters={{
          status: status ?? '',
          channel: channel ?? '',
          reference: reference ?? '',
        }}
        filterOptions={{ status: STATUS_OPTIONS, channel: CHANNEL_OPTIONS }}
        // Les champs sont anglais, les adresses restent françaises : le <select> du filtre
        // émet `?statut=`/`?canal=`, exactement ce que `sp.statut`/`sp.canal` relisent
        // ci-dessus. Voir la prop `filterParams` (src/admin/engine/table.tsx).
        filterParams={{ status: 'statut', channel: 'canal' }}
        columnFormatters={{
          total: (value) => formatAriary(Number(value)),
          status: (value) => statusLabel(String(value)),
          channel: (value) => channelLabel(String(value)),
          // L'heure compte autant que le jour pour retrouver une commande passée le matin
          // même : le formatage `date` générique d'AdminTable ne donne que la date.
          createdAt: (value) =>
            value instanceof Date
              ? value.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
              : String(value),
        }}
        // `row['id']` en notation crochet : le générique d'AdminTable est dérivé
        // d'orderSchema, qui ne déclare pas `id` (ce n'est pas une colonne). La ligne
        // réellement transmise (OrderListRow) le porte bien à l'exécution.
        link={{ column: 'reference', to: (row) => `/admin/commandes/${row['id']}` }}
      />
    </div>
  )
}
