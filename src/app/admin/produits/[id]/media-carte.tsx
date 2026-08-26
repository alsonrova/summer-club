'use client'

import { useActionState, useId } from 'react'
import type { EtatActionSimple } from '../etats'

type Media = { id: string; chemin: string; alt: string; position: number; isPrimary: boolean }

type ActionMedia = (etatPrecedent: EtatActionSimple, formData: FormData) => Promise<EtatActionSimple>

// Cadre en arche (rounded-arch) au ratio 4:5 : le motif signature de la marque (spec §3.9),
// appliqué ici à la vignette admin. `<picture>` avec les variantes AVIF/WebP déjà générées
// par traiterImage() plutôt que next/image : les fichiers sont déjà ré-encodés aux largeurs
// utiles (400/800/1200), un second passage d'optimisation serait redondant.
//
// Pas de glisser-déposer (hors périmètre de cette tâche) : un simple champ de position
// numérique, soumis via reordonnerMedia. Le texte alternatif, la désignation de la photo
// principale et la suppression sont chacun leur propre petit formulaire, sur le même
// modèle (useActionState, doublure EtatActionSimple) que le réordonnancement.
export function MediaCarte({
  media,
  actionReordonner,
  actionAlt,
  actionPrincipale,
  actionSupprimer,
}: {
  media: Media
  actionReordonner: ActionMedia
  actionAlt: ActionMedia
  actionPrincipale: ActionMedia
  actionSupprimer: ActionMedia
}) {
  const [etatPosition, soumettrePosition, positionEnCours] = useActionState(actionReordonner, {
    erreur: null,
  })
  const [etatAlt, soumettreAlt, altEnCours] = useActionState(actionAlt, { erreur: null })
  const [etatPrincipale, soumettrePrincipale, principaleEnCours] = useActionState(actionPrincipale, {
    erreur: null,
  })
  const [etatSuppression, soumettreSuppression, suppressionEnCours] = useActionState(actionSupprimer, {
    erreur: null,
  })
  const idPosition = useId()
  const idAlt = useId()

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

      {media.isPrimary ? (
        <span className="text-small text-bark-soft">Photo principale</span>
      ) : (
        <form action={soumettrePrincipale}>
          <button
            type="submit"
            disabled={principaleEnCours}
            className="text-small text-bark-soft underline hover:text-bark disabled:opacity-60"
          >
            Définir comme photo principale
          </button>
        </form>
      )}
      {etatPrincipale.erreur ? (
        <p role="alert" className="text-small text-bark">
          {etatPrincipale.erreur}
        </p>
      ) : null}

      <form action={soumettreAlt} className="flex flex-col gap-1">
        <label htmlFor={idAlt} className="text-small text-bark-soft">
          Texte alternatif
        </label>
        <div className="flex items-center gap-2">
          <input
            id={idAlt}
            name="alt"
            type="text"
            defaultValue={media.alt}
            className="w-full rounded border border-taupe/40 bg-shell px-2 py-1 text-bark"
          />
          <button
            type="submit"
            disabled={altEnCours}
            className="rounded border border-taupe/40 bg-shell px-2 py-1 text-small text-bark-soft hover:text-bark disabled:opacity-60"
          >
            Enregistrer
          </button>
        </div>
      </form>
      {etatAlt.erreur ? (
        <p role="alert" className="text-small text-bark">
          {etatAlt.erreur}
        </p>
      ) : null}

      <form action={soumettrePosition} className="flex items-center gap-2">
        <label htmlFor={idPosition} className="sr-only">
          Position
        </label>
        <input
          id={idPosition}
          name="position"
          type="number"
          defaultValue={media.position}
          className="w-16 rounded border border-taupe/40 bg-shell px-2 py-1 text-bark tabular-nums"
        />
        <button
          type="submit"
          disabled={positionEnCours}
          className="rounded border border-taupe/40 bg-shell px-2 py-1 text-small text-bark-soft hover:text-bark disabled:opacity-60"
        >
          Réordonner
        </button>
      </form>
      {etatPosition.erreur ? (
        <p role="alert" className="text-small text-bark">
          {etatPosition.erreur}
        </p>
      ) : null}

      <form
        action={soumettreSuppression}
        onSubmit={(evenement) => {
          if (!window.confirm('Supprimer définitivement cette photo ?')) {
            evenement.preventDefault()
          }
        }}
      >
        <button
          type="submit"
          disabled={suppressionEnCours}
          className="text-small text-bark-soft underline hover:text-bark disabled:opacity-60"
        >
          Supprimer
        </button>
      </form>
      {etatSuppression.erreur ? (
        <p role="alert" className="text-small text-bark">
          {etatSuppression.erreur}
        </p>
      ) : null}
    </div>
  )
}
