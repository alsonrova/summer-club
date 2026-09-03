'use client'

import { useActionState } from 'react'
import type { StatusChangeState } from '../states'

type ActionTransition = (
  previousState: StatusChangeState,
  formData: FormData,
) => Promise<StatusChangeState>

// Un bouton par transition, chacun dans son propre <form> avec son propre état : le message
// d'erreur s'affiche alors sous le bouton qui a échoué, et non dans un bandeau commun où
// la propriétaire devrait deviner lequel des cinq boutons l'a produit.
function TransitionButton({ action, label }: { action: ActionTransition; label: string }) {
  const [state, submit, isPending] = useActionState(action, { error: null })

  return (
    <form action={submit} className="flex flex-col gap-1">
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-taupe/40 bg-shell px-4 py-2 text-bark-soft hover:text-bark disabled:opacity-60"
      >
        {isPending ? 'En cours…' : label}
      </button>
      {state.error ? (
        <span role="alert" className="max-w-xs text-small text-bark">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}

/**
 * N'affiche QUE les transitions réellement autorisées depuis l'état courant (la liste vient
 * de `transitionsFrom`, côté serveur) : un bouton qui mène à une erreur est un défaut
 * d'interface. Une commande livrée ou annulée n'en propose donc aucun.
 */
export function StatusButtons({
  transitions,
}: {
  transitions: { to: string; label: string; action: ActionTransition }[]
}) {
  if (transitions.length === 0) {
    return (
      <p className="text-bark-soft">
        Cette commande a atteint un état final : plus aucun changement de statut n&apos;est
        possible.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      {transitions.map((transition) => (
        <TransitionButton
          key={transition.to}
          action={transition.action}
          label={transition.label}
        />
      ))}
    </div>
  )
}
