'use client'

import { useActionState, useId } from 'react'
import type { EtatActionSimple } from '../etats'

type Media = { id: string; chemin: string; alt: string; position: number; isPrimary: boolean }

// Cadre en arche (rounded-arch) au ratio 4:5 : le motif signature de la marque (spec §3.9),
// appliqué ici à la vignette admin. `<picture>` avec les variantes AVIF/WebP déjà générées
// par traiterImage() plutôt que next/image : les fichiers sont déjà ré-encodés aux largeurs
// utiles (400/800/1200), un second passage d'optimisation serait redondant.
//
// Pas de glisser-déposer (hors périmètre de cette tâche) : un simple champ de position
// numérique, soumis via reordonnerMedia.
export function MediaCarte({
  media,
  action,
}: {
  media: Media
  action: (etatPrecedent: EtatActionSimple, formData: FormData) => Promise<EtatActionSimple>
}) {
  const [etat, soumettre, enCours] = useActionState(action, { erreur: null })
  const id = useId()

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-[4/5] overflow-hidden rounded-arch border border-taupe/40 bg-clay">
        <picture>
          <source srcSet={`${media.chemin}-400.avif`} type="image/avif" />
          <source srcSet={`${media.chemin}-400.webp`} type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element -- fichier local déjà
              ré-encodé par traiterImage() aux largeurs utiles ; next/image le réoptimiserait
              inutilement une seconde fois. */}
          <img src={`${media.chemin}-400.webp`} alt={media.alt} className="h-full w-full object-cover" />
        </picture>
      </div>
      {media.isPrimary ? <span className="text-small text-bark-soft">Photo principale</span> : null}
      <form action={soumettre} className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          Position
        </label>
        <input
          id={id}
          name="position"
          type="number"
          defaultValue={media.position}
          className="w-16 rounded border border-taupe/40 bg-shell px-2 py-1 text-bark tabular-nums"
        />
        <button
          type="submit"
          disabled={enCours}
          className="rounded border border-taupe/40 bg-shell px-2 py-1 text-small text-bark-soft hover:text-bark disabled:opacity-60"
        >
          Réordonner
        </button>
      </form>
      {etat.erreur ? (
        <p role="alert" className="text-small text-bark">
          {etat.erreur}
        </p>
      ) : null}
    </div>
  )
}
