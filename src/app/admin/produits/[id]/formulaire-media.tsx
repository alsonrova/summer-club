'use client'

import { useActionState } from 'react'
import type { EtatActionSimple } from '../etats'

export function FormulaireMedia({
  action,
}: {
  action: (etatPrecedent: EtatActionSimple, formData: FormData) => Promise<EtatActionSimple>
}) {
  const [etat, soumettre, enCours] = useActionState(action, { erreur: null })

  return (
    <form action={soumettre} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="media-fichier" className="text-small text-bark-soft">
          Ajouter une photo
        </label>
        <input
          id="media-fichier"
          name="fichier"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="text-small text-bark"
        />
      </div>
      <button
        type="submit"
        disabled={enCours}
        className="rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90 disabled:opacity-60"
      >
        Téléverser
      </button>
      {etat.erreur ? (
        <p role="alert" className="w-full text-small text-bark">
          {etat.erreur}
        </p>
      ) : null}
    </form>
  )
}
