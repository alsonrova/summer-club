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
import { listerCommandesPaginees } from './query'

function versPageValide(valeur: string | undefined): number {
  const n = Number(valeur)
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1
}

function texteCourt(valeur: unknown): string {
  const s = typeof valeur === 'string' ? valeur.trim() : ''
  return s.slice(0, 60)
}

const OPTIONS_STATUT = ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))
const OPTIONS_CANAL = CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))

// Chaque page d'administration appelle requireAdmin() elle-même : voir la convention dans
// src/server/auth.ts — le layout ne suffit pas.
export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()

  const sp = await searchParams
  const statutBrut = typeof sp.statut === 'string' ? sp.statut : undefined
  const canalBrut = typeof sp.canal === 'string' ? sp.canal : undefined
  const referenceBrut = typeof sp.reference === 'string' ? sp.reference : undefined

  // La querystring est écrite par le visiteur : un statut ou un canal inconnu est ignoré
  // plutôt que transmis à Prisma, qui répondrait par une erreur d'énumération PostgreSQL.
  // Les deux passent par le même genre de garde de type, jamais par un `as`.
  const statut = isOrderStatus(statutBrut) ? statutBrut : undefined
  const canal = isChannel(canalBrut) ? canalBrut : undefined
  const reference = texteCourt(referenceBrut) || undefined
  const page = versPageValide(typeof sp.page === 'string' ? sp.page : undefined)

  const { lignes, page: pageCourante, totalPages, total } = await listerCommandesPaginees(
    prisma.order,
    { page, filtres: { statut, canal, reference } },
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
        rows={lignes}
        basePath="/admin/commandes"
        page={pageCourante}
        totalPages={totalPages}
        filters={{
          statut: statut ?? '',
          canal: canal ?? '',
          reference: reference ?? '',
        }}
        filterOptions={{ statut: OPTIONS_STATUT, canal: OPTIONS_CANAL }}
        columnFormatters={{
          total: (valeur) => formatAriary(Number(valeur)),
          statut: (valeur) => statusLabel(String(valeur)),
          canal: (valeur) => channelLabel(String(valeur)),
          // L'heure compte autant que le jour pour retrouver une commande passée le matin
          // même : le formatage `date` générique d'AdminTable ne donne que la date.
          createdAt: (valeur) =>
            valeur instanceof Date
              ? valeur.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
              : String(valeur),
        }}
        // `ligne['id']` en notation crochet : le générique d'AdminTable est dérivé
        // d'orderSchema, qui ne déclare pas `id` (ce n'est pas une colonne). La ligne
        // réellement transmise (LigneCommandeListe) le porte bien à l'exécution.
        link={{ column: 'reference', to: (ligne) => `/admin/commandes/${ligne['id']}` }}
      />
    </div>
  )
}
