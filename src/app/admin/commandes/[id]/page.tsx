import { notFound } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import { formatAriary } from '@/domain/money'
import { transitionsFrom, type OrderStatus } from '@/domain/order-status'
import { TRANSITION_LABELS, channelLabel, statusLabel } from '@/admin/resources/orders'
import { changeStatusFromForm } from '../actions'
import { StatusButtons } from './status-buttons'

// `avant`/`apres` du journal d'audit sont des colonnes Json : Prisma les rend en
// `JsonValue`, dont rien ne garantit la forme à la relecture (une trace ancienne, une
// future action qui journaliserait autre chose). On extrait prudemment.
function statusFromTrace(value: Prisma.JsonValue | null): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const status = (value as Record<string, unknown>)['statut']
  return typeof status === 'string' ? status : null
}

function formatDateTime(value: Date): string {
  return value.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function DetailRow({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small text-bark-soft">{libelle}</dt>
      <dd className="text-bark">{children}</dd>
    </div>
  )
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const [order, history] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      // `items` porte les valeurs FIGÉES à la commande (nomFige, prixUnitaireFige) : on
      // n'affiche donc jamais le prix courant du catalogue, qui a pu changer depuis.
      include: { items: { orderBy: { id: 'asc' } }, zone: true },
    }),
    // Le journal d'audit est la seule source de l'historique de statut : `applyStatus`
    // y écrit dans la même transaction que le changement lui-même.
    prisma.auditLog.findMany({
      where: { entite: 'Order', entiteId: id, action: 'changement_statut' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ])

  if (!order) notFound()

  const status = order.statut as OrderStatus
  const transitions = transitionsFrom(status).map((to) => ({
    to,
    label: TRANSITION_LABELS[to],
    action: changeStatusFromForm.bind(null, order.id, to),
  }))

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-2xl font-light text-bark">
          Commande {order.reference}
        </h1>
        <p className="mt-1 text-bark-soft">
          {statusLabel(status)} · {channelLabel(order.canal)} · {formatDateTime(order.createdAt)}
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Cliente</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow libelle="Nom">{order.clientNom}</DetailRow>
          <DetailRow libelle="Téléphone">{order.tel}</DetailRow>
          <DetailRow libelle="Adresse e-mail">{order.email ?? '—'}</DetailRow>
          <DetailRow libelle="Adresse de livraison">{order.adresse ?? '—'}</DetailRow>
          <DetailRow libelle="Zone de livraison">
            {order.zone ? `${order.zone.nom} — ${order.zone.delai}` : '—'}
          </DetailRow>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Articles</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-taupe/40">
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Article</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Prix unitaire</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Quantité</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-taupe/40">
                  <td className="px-3 py-2 text-bark">{item.nomFige}</td>
                  <td className="px-3 py-2 text-bark tabular-nums">
                    {formatAriary(item.prixUnitaireFige)}
                  </td>
                  <td className="px-3 py-2 text-bark tabular-nums">{item.quantite}</td>
                  <td className="px-3 py-2 text-bark tabular-nums">
                    {formatAriary(item.prixUnitaireFige * item.quantite)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 grid gap-2 sm:max-w-xs">
          <div className="flex justify-between">
            <dt className="text-bark-soft">Sous-total</dt>
            <dd className="text-bark tabular-nums">{formatAriary(order.sousTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bark-soft">Livraison</dt>
            <dd className="text-bark tabular-nums">{formatAriary(order.fraisLivraison)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bark-soft">Remise</dt>
            <dd className="text-bark tabular-nums">{formatAriary(order.remise)}</dd>
          </div>
          <div className="flex justify-between border-t border-taupe/40 pt-2">
            <dt className="text-bark">Total</dt>
            <dd className="text-bark tabular-nums">{formatAriary(order.total)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Changer le statut</h2>
        <StatusButtons transitions={transitions} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Historique</h2>
        {history.length === 0 ? (
          <p className="text-bark-soft">
            Aucun changement de statut depuis la création de la commande.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {history.map((trace) => {
              const from = statusFromTrace(trace.avant)
              const to = statusFromTrace(trace.apres)
              return (
                <li key={trace.id} className="text-bark">
                  <span className="tabular-nums text-bark-soft">{formatDateTime(trace.createdAt)}</span>
                  {' — '}
                  {from ? statusLabel(from) : '?'} → {to ? statusLabel(to) : '?'}
                  {' · '}
                  <span className="text-bark-soft">{trace.acteur}</span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
