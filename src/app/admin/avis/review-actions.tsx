'use client'

import { useActionState } from 'react'
import type { ReviewActionState } from './states'

type ReviewAction = (
  previousState: ReviewActionState,
  formData: FormData,
) => Promise<ReviewActionState>

function ActionButton({
  action,
  label,
  primary = false,
}: {
  action: ReviewAction
  label: string
  primary?: boolean
}) {
  const [state, submit, isPending] = useActionState(action, { error: null })

  return (
    <form action={submit} className="inline-flex flex-col gap-1">
      <button
        type="submit"
        disabled={isPending}
        className={
          primary
            ? 'rounded border border-taupe/40 bg-sage-deep px-3 py-1 text-small text-shell hover:opacity-90 disabled:opacity-60'
            : 'rounded border border-taupe/40 bg-shell px-3 py-1 text-small text-bark-soft hover:text-bark disabled:opacity-60'
        }
      >
        {isPending ? '…' : label}
      </button>
      {state.error ? (
        <span role="alert" className="text-small text-bark">
          {state.error}
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
export function ReviewActions({
  publish,
  reject,
  togglePinned,
  status,
  pinned,
}: {
  publish: ReviewAction
  reject: ReviewAction
  togglePinned: ReviewAction
  status: 'pending' | 'published' | 'rejected'
  pinned: boolean
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {status !== 'published' ? <ActionButton action={publish} label="Publier" primary /> : null}
      {status !== 'rejected' ? <ActionButton action={reject} label="Rejeter" /> : null}
      {status === 'published' ? (
        <ActionButton
          action={togglePinned}
          label={pinned ? "Retirer de l'accueil" : "Épingler à l'accueil"}
        />
      ) : null}
    </div>
  )
}
