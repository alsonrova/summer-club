import type { Route } from 'next'
import Link from 'next/link'
import type { StatutAvis } from '@prisma/client'
import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import {
  epinglerAvisDepuisFormulaire,
  importerTemoignageDepuisFormulaire,
  modererAvisDepuisFormulaire,
} from './actions'
import {
  estStatutAvis,
  listerAvisPagines,
  LIBELLES_SOURCE_AVIS,
  LIBELLES_STATUT_AVIS,
  STATUTS_AVIS,
} from './query'
import { ActionsAvis } from './actions-avis'
import { FormulaireTemoignage } from './formulaire-temoignage'

function versPageValide(valeur: string | undefined): number {
  const n = Number(valeur)
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1
}

function versStatutAvis(valeur: string | undefined): StatutAvis | undefined {
  return estStatutAvis(valeur) ? valeur : undefined
}

function urlListe(statut: string, page?: number): Route {
  const params = new URLSearchParams()
  if (statut) params.set('statut', statut)
  if (page && page > 1) params.set('page', String(page))
  const qs = params.toString()
  return (qs ? `/admin/avis?${qs}` : '/admin/avis') as Route
}

export default async function AvisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()

  const sp = await searchParams
  const statut = versStatutAvis(typeof sp.statut === 'string' ? sp.statut : undefined)
  const page = versPageValide(typeof sp.page === 'string' ? sp.page : undefined)

  const [resultat, produits, compteEnAttente] = await Promise.all([
    listerAvisPagines(prisma.review, { page, filtres: { statut } }),
    prisma.product.findMany({ orderBy: { nom: 'asc' }, select: { id: true, nom: true } }),
    prisma.review.count({ where: { statut: 'en_attente' } }),
  ])

  const { lignes, page: pageCourante, totalPages, total } = resultat

  return (
    <div className="flex flex-col gap-10">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-light text-bark">Avis</h1>
          <p className="text-small text-bark-soft tabular-nums">
            {total} avis · {compteEnAttente} en attente
          </p>
        </div>

        <nav className="flex flex-wrap gap-3 text-small">
          <Link
            href={urlListe('')}
            className={statut === undefined ? 'text-bark underline' : 'text-bark-soft underline'}
          >
            Tous
          </Link>
          {STATUTS_AVIS.map((valeur) => (
            <Link
              key={valeur}
              href={urlListe(valeur)}
              className={statut === valeur ? 'text-bark underline' : 'text-bark-soft underline'}
            >
              {LIBELLES_STATUT_AVIS[valeur]}
            </Link>
          ))}
        </nav>
      </div>

      <section>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-taupe/40">
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Autrice</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Note</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Témoignage</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Produit</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Origine</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Statut</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Accueil</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-bark-soft">
                    Aucun avis.
                  </td>
                </tr>
              ) : (
                lignes.map((avis) => (
                  <tr key={avis.id} className="border-b border-taupe/40 align-top">
                    <td className="px-3 py-2 text-bark">{avis.auteur}</td>
                    <td className="px-3 py-2 text-bark tabular-nums">{avis.note} / 5</td>
                    <td className="max-w-md px-3 py-2 text-bark">{avis.texte}</td>
                    <td className="px-3 py-2 text-bark">{avis.produit ?? '—'}</td>
                    <td className="px-3 py-2 text-bark">{LIBELLES_SOURCE_AVIS[avis.source]}</td>
                    <td className="px-3 py-2 text-bark">{LIBELLES_STATUT_AVIS[avis.statut]}</td>
                    {/* Une colonne dédiée plutôt qu'un libellé noyé dans les actions : la
                        question « lesquels sont épinglés ? » doit se lire d'un coup d'œil,
                        en balayant une seule colonne. */}
                    <td className="px-3 py-2 text-bark">{avis.epingle ? 'Épinglé' : '—'}</td>
                    <td className="px-3 py-2">
                      <ActionsAvis
                        statut={avis.statut}
                        epingle={avis.epingle}
                        publier={modererAvisDepuisFormulaire.bind(null, avis.id, 'publie')}
                        rejeter={modererAvisDepuisFormulaire.bind(null, avis.id, 'rejete')}
                        basculerEpingle={epinglerAvisDepuisFormulaire.bind(
                          null,
                          avis.id,
                          !avis.epingle,
                        )}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <nav className="mt-4 flex items-center gap-4 text-small text-bark-soft">
            {pageCourante > 1 ? (
              <Link href={urlListe(statut ?? '', pageCourante - 1)} className="underline">
                Précédent
              </Link>
            ) : (
              <span className="opacity-40">Précédent</span>
            )}
            <span className="tabular-nums">
              Page {pageCourante} / {totalPages}
            </span>
            {pageCourante < totalPages ? (
              <Link href={urlListe(statut ?? '', pageCourante + 1)} className="underline">
                Suivant
              </Link>
            ) : (
              <span className="opacity-40">Suivant</span>
            )}
          </nav>
        ) : null}
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-light text-bark">
          Importer un témoignage
        </h2>
        <p className="mb-4 text-small text-bark-soft">
          Pour un mot reçu par WhatsApp, en commentaire Instagram ou en boutique. Il sera
          publié comme « Importé » : le badge « Achat vérifié » reste réservé aux avis
          laissés par une cliente à partir de sa propre commande livrée.
        </p>
        <FormulaireTemoignage
          action={importerTemoignageDepuisFormulaire}
          produits={produits}
        />
      </section>
    </div>
  )
}
