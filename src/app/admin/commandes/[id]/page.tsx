import { notFound } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import { formatAriary } from '@/domain/money'
import { transitionsFrom, type OrderStatus } from '@/domain/order-status'
import { LIBELLES_TRANSITION, libelleCanal, libelleStatut } from '@/admin/resources/orders'
import { changerStatutDepuisFormulaire } from '../actions'
import { BoutonsStatut } from './boutons-statut'

// `avant`/`apres` du journal d'audit sont des colonnes Json : Prisma les rend en
// `JsonValue`, dont rien ne garantit la forme à la relecture (une trace ancienne, une
// future action qui journaliserait autre chose). On extrait prudemment.
function statutDeTrace(valeur: Prisma.JsonValue | null): string | null {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return null
  const statut = (valeur as Record<string, unknown>)['statut']
  return typeof statut === 'string' ? statut : null
}

function dateHeure(valeur: Date): string {
  return valeur.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small text-bark-soft">{libelle}</dt>
      <dd className="text-bark">{children}</dd>
    </div>
  )
}

export default async function FicheCommandePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const [commande, historique] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      // `items` porte les valeurs FIGÉES à la commande (nomFige, prixUnitaireFige) : on
      // n'affiche donc jamais le prix courant du catalogue, qui a pu changer depuis.
      include: { items: { orderBy: { id: 'asc' } }, zone: true },
    }),
    // Le journal d'audit est la seule source de l'historique de statut : `appliquerStatut`
    // y écrit dans la même transaction que le changement lui-même.
    prisma.auditLog.findMany({
      where: { entite: 'Order', entiteId: id, action: 'changement_statut' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ])

  if (!commande) notFound()

  const statut = commande.statut as OrderStatus
  const transitions = transitionsFrom(statut).map((vers) => ({
    vers,
    libelle: LIBELLES_TRANSITION[vers],
    action: changerStatutDepuisFormulaire.bind(null, commande.id, vers),
  }))

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-2xl font-light text-bark">
          Commande {commande.reference}
        </h1>
        <p className="mt-1 text-bark-soft">
          {libelleStatut(statut)} · {libelleCanal(commande.canal)} · {dateHeure(commande.createdAt)}
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Cliente</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Ligne libelle="Nom">{commande.clientNom}</Ligne>
          <Ligne libelle="Téléphone">{commande.tel}</Ligne>
          <Ligne libelle="Adresse e-mail">{commande.email ?? '—'}</Ligne>
          <Ligne libelle="Adresse de livraison">{commande.adresse ?? '—'}</Ligne>
          <Ligne libelle="Zone de livraison">
            {commande.zone ? `${commande.zone.nom} — ${commande.zone.delai}` : '—'}
          </Ligne>
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
              {commande.items.map((item) => (
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
            <dd className="text-bark tabular-nums">{formatAriary(commande.sousTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bark-soft">Livraison</dt>
            <dd className="text-bark tabular-nums">{formatAriary(commande.fraisLivraison)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bark-soft">Remise</dt>
            <dd className="text-bark tabular-nums">{formatAriary(commande.remise)}</dd>
          </div>
          <div className="flex justify-between border-t border-taupe/40 pt-2">
            <dt className="text-bark">Total</dt>
            <dd className="text-bark tabular-nums">{formatAriary(commande.total)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Changer le statut</h2>
        <BoutonsStatut transitions={transitions} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Historique</h2>
        {historique.length === 0 ? (
          <p className="text-bark-soft">
            Aucun changement de statut depuis la création de la commande.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {historique.map((trace) => {
              const de = statutDeTrace(trace.avant)
              const vers = statutDeTrace(trace.apres)
              return (
                <li key={trace.id} className="text-bark">
                  <span className="tabular-nums text-bark-soft">{dateHeure(trace.createdAt)}</span>
                  {' — '}
                  {de ? libelleStatut(de) : '?'} → {vers ? libelleStatut(vers) : '?'}
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
