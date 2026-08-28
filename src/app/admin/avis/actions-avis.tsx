'use client'

import { useActionState } from 'react'
import type { EtatActionAvis } from './etats'

type ActionAvis = (
  etatPrecedent: EtatActionAvis,
  formData: FormData,
) => Promise<EtatActionAvis>

function BoutonAction({
  action,
  libelle,
  primaire = false,
}: {
  action: ActionAvis
  libelle: string
  primaire?: boolean
}) {
  const [etat, soumettre, enCours] = useActionState(action, { erreur: null })

  return (
    <form action={soumettre} className="inline-flex flex-col gap-1">
      <button
        type="submit"
        disabled={enCours}
        className={
          primaire
            ? 'rounded border border-taupe/40 bg-sage-deep px-3 py-1 text-small text-shell hover:opacity-90 disabled:opacity-60'
            : 'rounded border border-taupe/40 bg-shell px-3 py-1 text-small text-bark-soft hover:text-bark disabled:opacity-60'
        }
      >
        {enCours ? '…' : libelle}
      </button>
      {etat.erreur ? (
        <span role="alert" className="text-small text-bark">
          {etat.erreur}
        </span>
      ) : null}
    </form>
  )
}

/**
 * Les actions réellement possibles pour un avis, et rien d'autre : on ne propose pas
 * « publier » un avis déjà publié, ni d'épingler un avis qui n'est pas en vitrine — un
 * avis épinglé mais non publié n'apparaîtrait nulle part, sans que rien ne l'explique.
 */
export function ActionsAvis({
  publier,
  rejeter,
  basculerEpingle,
  statut,
  epingle,
}: {
  publier: ActionAvis
  rejeter: ActionAvis
  basculerEpingle: ActionAvis
  statut: 'en_attente' | 'publie' | 'rejete'
  epingle: boolean
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {statut !== 'publie' ? <BoutonAction action={publier} libelle="Publier" primaire /> : null}
      {statut !== 'rejete' ? <BoutonAction action={rejeter} libelle="Rejeter" /> : null}
      {statut === 'publie' ? (
        <BoutonAction
          action={basculerEpingle}
          libelle={epingle ? "Retirer de l'accueil" : "Épingler à l'accueil"}
        />
      ) : null}
    </div>
  )
}
