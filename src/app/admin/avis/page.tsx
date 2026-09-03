import type { Route } from 'next'
import Link from 'next/link'
import type { ReviewStatus } from '@prisma/client'
import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import {
  pinReviewFromForm,
  importTestimonialFromForm,
  moderateReviewFromForm,
} from './actions'
import {
  isReviewStatus,
  listReviewsPaginated,
  REVIEW_SOURCE_LABELS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUSES,
} from './query'
import { ReviewActions } from './review-actions'
import { TestimonialForm } from './testimonial-form'

function toValidPage(value: string | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1
}

function toReviewStatus(value: string | undefined): ReviewStatus | undefined {
  return isReviewStatus(value) ? value : undefined
}

function listUrl(status: string, page?: number): Route {
  const params = new URLSearchParams()
  if (status) params.set('statut', status)
  if (page && page > 1) params.set('page', String(page))
  const qs = params.toString()
  return (qs ? `/admin/avis?${qs}` : '/admin/avis') as Route
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()

  const sp = await searchParams
  const status = toReviewStatus(typeof sp.statut === 'string' ? sp.statut : undefined)
  const page = toValidPage(typeof sp.page === 'string' ? sp.page : undefined)

  const [result, products, pendingCount] = await Promise.all([
    listReviewsPaginated(prisma.review, { page, filters: { status } }),
    prisma.product.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.review.count({ where: { status: 'pending' } }),
  ])

  const { rows, page: currentPage, totalPages, total } = result

  return (
    <div className="flex flex-col gap-10">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-light text-bark">Avis</h1>
          <p className="text-small text-bark-soft tabular-nums">
            {total} avis · {pendingCount} en attente
          </p>
        </div>

        <nav className="flex flex-wrap gap-3 text-small">
          <Link
            href={listUrl('')}
            className={status === undefined ? 'text-bark underline' : 'text-bark-soft underline'}
          >
            Tous
          </Link>
          {REVIEW_STATUSES.map((value) => (
            <Link
              key={value}
              href={listUrl(value)}
              className={status === value ? 'text-bark underline' : 'text-bark-soft underline'}
            >
              {REVIEW_STATUS_LABELS[value]}
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-bark-soft">
                    Aucun avis.
                  </td>
                </tr>
              ) : (
                rows.map((review) => (
                  <tr key={review.id} className="border-b border-taupe/40 align-top">
                    <td className="px-3 py-2 text-bark">{review.author}</td>
                    <td className="px-3 py-2 text-bark tabular-nums">{review.rating} / 5</td>
                    <td className="max-w-md px-3 py-2 text-bark">{review.body}</td>
                    <td className="px-3 py-2 text-bark">{review.product ?? '—'}</td>
                    <td className="px-3 py-2 text-bark">{REVIEW_SOURCE_LABELS[review.source]}</td>
                    <td className="px-3 py-2 text-bark">{REVIEW_STATUS_LABELS[review.status]}</td>
                    {/* Une colonne dédiée plutôt qu'un libellé noyé dans les actions : la
                        question « lesquels sont épinglés ? » doit se lire d'un coup d'œil,
                        en balayant une seule colonne. */}
                    <td className="px-3 py-2 text-bark">{review.pinned ? 'Épinglé' : '—'}</td>
                    <td className="px-3 py-2">
                      <ReviewActions
                        status={review.status}
                        pinned={review.pinned}
                        publish={moderateReviewFromForm.bind(null, review.id, 'published')}
                        reject={moderateReviewFromForm.bind(null, review.id, 'rejected')}
                        togglePinned={pinReviewFromForm.bind(
                          null,
                          review.id,
                          !review.pinned,
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
            {currentPage > 1 ? (
              <Link href={listUrl(status ?? '', currentPage - 1)} className="underline">
                Précédent
              </Link>
            ) : (
              <span className="opacity-40">Précédent</span>
            )}
            <span className="tabular-nums">
              Page {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={listUrl(status ?? '', currentPage + 1)} className="underline">
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
        <TestimonialForm
          action={importTestimonialFromForm}
          products={products}
        />
      </section>
    </div>
  )
}
