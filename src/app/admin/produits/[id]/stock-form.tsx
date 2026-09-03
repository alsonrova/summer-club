'use client'

import { useActionState, useId } from 'react'
import type { SimpleActionState } from '../states'

// Un article en rupture n'affiche pas un bouton grisé mais une mention textuelle
// explicite (spec §3.8) — reprise ici pour l'écran de stock, pas seulement en boutique.
export function StockForm({
  action,
  currentStock,
  lowStockThreshold,
}: {
  action: (previousState: SimpleActionState, formData: FormData) => Promise<SimpleActionState>
  currentStock: number
  lowStockThreshold: number
}) {
  const [state, submit, isPending] = useActionState(action, { error: null })
  const id = useId()
  const outOfStock = currentStock <= 0
  const low = !outOfStock && currentStock <= lowStockThreshold

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Stock
      </label>
      <input
        id={id}
        name="stock"
        type="number"
        defaultValue={currentStock}
        className="w-20 rounded border border-taupe/40 bg-shell px-2 py-1 text-bark tabular-nums"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-taupe/40 bg-shell px-2 py-1 text-small text-bark-soft hover:text-bark disabled:opacity-60"
      >
        Ajuster
      </button>
      {outOfStock ? (
        <span className="text-small text-bark">Rupture</span>
      ) : low ? (
        <span className="text-small text-bark-soft">Stock bas</span>
      ) : null}
      {state.error ? (
        <span role="alert" className="text-small text-bark">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}
