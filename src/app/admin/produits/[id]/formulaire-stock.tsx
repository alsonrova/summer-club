'use client'

import { useActionState, useId } from 'react'
import type { EtatActionSimple } from '../etats'

// Un article en rupture n'affiche pas un bouton grisé mais une mention textuelle
// explicite (spec §3.8) — reprise ici pour l'écran de stock, pas seulement en boutique.
export function FormulaireStock({
  action,
  stockActuel,
  seuilAlerte,
}: {
  action: (etatPrecedent: EtatActionSimple, formData: FormData) => Promise<EtatActionSimple>
  stockActuel: number
  seuilAlerte: number
}) {
  const [etat, soumettre, enCours] = useActionState(action, { erreur: null })
  const id = useId()
  const enRupture = stockActuel <= 0
  const bas = !enRupture && stockActuel <= seuilAlerte

  return (
    <form action={soumettre} className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Stock
      </label>
      <input
        id={id}
        name="stock"
        type="number"
        defaultValue={stockActuel}
        className="w-20 rounded border border-taupe/40 bg-shell px-2 py-1 text-bark tabular-nums"
      />
      <button
        type="submit"
        disabled={enCours}
        className="rounded border border-taupe/40 bg-shell px-2 py-1 text-small text-bark-soft hover:text-bark disabled:opacity-60"
      >
        Ajuster
      </button>
      {enRupture ? (
        <span className="text-small text-bark">Rupture</span>
      ) : bas ? (
        <span className="text-small text-bark-soft">Stock bas</span>
      ) : null}
      {etat.erreur ? (
        <span role="alert" className="text-small text-bark">
          {etat.erreur}
        </span>
      ) : null}
    </form>
  )
}
