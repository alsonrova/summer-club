'use client'

import { useActionState, useId } from 'react'
import type { SimpleActionState } from '../states'

type Media = { id: string; chemin: string; alt: string; position: number; isPrimary: boolean }

type ActionMedia = (previousState: SimpleActionState, formData: FormData) => Promise<SimpleActionState>

// Cadre en arche (rounded-arch) au ratio 4:5 : le motif signature de la marque (spec §3.9),
// appliqué ici à la vignette admin. `<picture>` avec les variantes AVIF/WebP déjà générées
// par processImage() plutôt que next/image : les fichiers sont déjà ré-encodés aux largeurs
// utiles (400/800/1200), un second passage d'optimisation serait redondant.
//
// Pas de glisser-déposer (hors périmètre de cette tâche) : un simple champ de position
// numérique, soumis via reorderAction. Le texte alternatif, la désignation de la photo
// principale et la suppression sont chacun leur propre petit formulaire, sur le même
// modèle (useActionState, doublure SimpleActionState) que le réordonnancement.
export function MediaCard({
  media,
  reorderAction,
  altAction,
  primaryAction,
  deleteAction,
}: {
  media: Media
  reorderAction: ActionMedia
  altAction: ActionMedia
  primaryAction: ActionMedia
  deleteAction: ActionMedia
}) {
  const [positionState, submitPosition, positionPending] = useActionState(reorderAction, {
    error: null,
  })
  const [altState, submitAlt, altPending] = useActionState(altAction, { error: null })
  const [primaryState, submitPrimary, primaryPending] = useActionState(primaryAction, {
    error: null,
  })
  const [deleteState, submitDelete, deletePending] = useActionState(deleteAction, {
    error: null,
  })
  const positionId = useId()
  const altId = useId()

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-[4/5] overflow-hidden rounded-arch border border-taupe/40 bg-clay">
        <picture>
          <source srcSet={`${media.chemin}-400.avif`} type="image/avif" />
          <source srcSet={`${media.chemin}-400.webp`} type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element -- fichier local déjà
              ré-encodé par processImage() aux largeurs utiles ; next/image le réoptimiserait
              inutilement une seconde fois. */}
          <img src={`${media.chemin}-400.webp`} alt={media.alt} className="h-full w-full object-cover" />
        </picture>
      </div>

      {media.isPrimary ? (
        <span className="text-small text-bark-soft">Photo principale</span>
      ) : (
        <form action={submitPrimary}>
          <button
            type="submit"
            disabled={primaryPending}
            className="text-small text-bark-soft underline hover:text-bark disabled:opacity-60"
          >
            Définir comme photo principale
          </button>
        </form>
      )}
      {primaryState.error ? (
        <p role="alert" className="text-small text-bark">
          {primaryState.error}
        </p>
      ) : null}

      <form action={submitAlt} className="flex flex-col gap-1">
        <label htmlFor={altId} className="text-small text-bark-soft">
          Texte alternatif
        </label>
        <div className="flex items-center gap-2">
          <input
            id={altId}
            name="alt"
            type="text"
            defaultValue={media.alt}
            className="w-full rounded border border-taupe/40 bg-shell px-2 py-1 text-bark"
          />
          <button
            type="submit"
            disabled={altPending}
            className="rounded border border-taupe/40 bg-shell px-2 py-1 text-small text-bark-soft hover:text-bark disabled:opacity-60"
          >
            Enregistrer
          </button>
        </div>
      </form>
      {altState.error ? (
        <p role="alert" className="text-small text-bark">
          {altState.error}
        </p>
      ) : null}

      <form action={submitPosition} className="flex items-center gap-2">
        <label htmlFor={positionId} className="sr-only">
          Position
        </label>
        <input
          id={positionId}
          name="position"
          type="number"
          defaultValue={media.position}
          className="w-16 rounded border border-taupe/40 bg-shell px-2 py-1 text-bark tabular-nums"
        />
        <button
          type="submit"
          disabled={positionPending}
          className="rounded border border-taupe/40 bg-shell px-2 py-1 text-small text-bark-soft hover:text-bark disabled:opacity-60"
        >
          Réordonner
        </button>
      </form>
      {positionState.error ? (
        <p role="alert" className="text-small text-bark">
          {positionState.error}
        </p>
      ) : null}

      <form
        action={submitDelete}
        onSubmit={(event) => {
          if (!window.confirm('Supprimer définitivement cette photo ?')) {
            event.preventDefault()
          }
        }}
      >
        <button
          type="submit"
          disabled={deletePending}
          className="text-small text-bark-soft underline hover:text-bark disabled:opacity-60"
        >
          Supprimer
        </button>
      </form>
      {deleteState.error ? (
        <p role="alert" className="text-small text-bark">
          {deleteState.error}
        </p>
      ) : null}
    </div>
  )
}
