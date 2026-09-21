import type { ReviewSource } from '@prisma/client'
import { Reveal } from '@/components/ui/reveal'

// Ce que la page d'accueil montre d'un avis, et rien de plus : ni la commande, ni le
// produit, ni la date. Même parti pris que StorefrontProduct (tâche 14) — ce qui n'est pas
// projeté par le serveur ne peut pas fuiter dans le HTML.
export type HomeReview = {
  id: string
  rating: number
  body: string
  author: string
  source: ReviewSource
}

const MAX_RATING = 5

// Avis épinglés (spec § 8.4). Le badge « Achat vérifié » n'apparaît que pour `verified` :
// il atteste d'un achat réellement livré (l'avis est rattaché à une commande), là où
// `imported` est un témoignage recopié d'Instagram ou de WhatsApp par la propriétaire.
// Poser le badge sur un témoignage importé serait une affirmation fausse.
//
// La section s'efface entièrement quand rien n'est épinglé : une boutique neuve n'a pas
// encore d'avis, et « Elles les portent » au-dessus du vide dit exactement le contraire de
// ce qu'on veut dire.
export function Reviews({ reviews }: { reviews: HomeReview[] }) {
  if (reviews.length === 0) return null

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
      <Reveal>
        <h2 className="text-h2">Elles les portent</h2>
      </Reveal>
      <div className="mt-14 grid gap-8 md:grid-cols-3">
        {reviews.map((review, index) => (
          <Reveal key={review.id} delay={index * 70}>
            <figure className="h-full rounded-2xl bg-shell p-7 ring-1 ring-taupe/40">
              {/* Des étoiles ne se comptent pas au lecteur d'écran : la note s'y annonce
                  en toutes lettres. Le taupe borde et sépare, il n'écrit pas — la note
                  reste en bark-soft (tests/tokens.test.ts, constat du testeur UX/UI de la
                  tâche 14 sur la mention « Rupture »). */}
              <p className="text-small text-bark-soft" aria-label={`${review.rating} sur ${MAX_RATING}`}>
                {'★'.repeat(review.rating)}
                {'☆'.repeat(MAX_RATING - review.rating)}
              </p>
              <blockquote className="mt-4 font-display text-lg leading-[1.4]">
                {review.body}
              </blockquote>
              <figcaption className="mt-5 text-small text-bark-soft">
                {review.author}
                {review.source === 'verified' && (
                  <span className="ml-2 rounded-full bg-clay px-2.5 py-1 text-eyebrow uppercase tracking-[.1em] text-bark">
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
