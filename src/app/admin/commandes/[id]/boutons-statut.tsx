'use client'

import { useActionState } from 'react'
import type { EtatChangementStatut } from '../etats'

type ActionTransition = (
  etatPrecedent: EtatChangementStatut,
  formData: FormData,
) => Promise<EtatChangementStatut>

// Un bouton par transition, chacun dans son propre <form> avec son propre état : le message
// d'erreur s'affiche alors sous le bouton qui a échoué, et non dans un bandeau commun où
// la propriétaire devrait deviner lequel des cinq boutons l'a produit.
function BoutonTransition({ action, libelle }: { action: ActionTransition; libelle: string }) {
  const [etat, soumettre, enCours] = useActionState(action, { erreur: null })

  return (
    <form action={soumettre} className="flex flex-col gap-1">
      <button
        type="submit"
        disabled={enCours}
        className="rounded border border-taupe/40 bg-shell px-4 py-2 text-bark-soft hover:text-bark disabled:opacity-60"
      >
        {enCours ? 'En cours…' : libelle}
      </button>
      {etat.erreur ? (
        <span role="alert" className="max-w-xs text-small text-bark">
          {etat.erreur}
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
export function BoutonsStatut({
  transitions,
}: {
  transitions: { vers: string; libelle: string; action: ActionTransition }[]
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
        <BoutonTransition
          key={transition.vers}
          action={transition.action}
          libelle={transition.libelle}
        />
      ))}
    </div>
  )
}
