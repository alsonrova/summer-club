'use client'

import { useActionState } from 'react'
import type { SimpleActionState } from '../states'

export function MediaForm({
  action,
}: {
  action: (previousState: SimpleActionState, formData: FormData) => Promise<SimpleActionState>
}) {
  const [state, submit, isPending] = useActionState(action, { error: null })

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3">
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
        disabled={isPending}
        className="rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90 disabled:opacity-60"
      >
        Téléverser
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-small text-bark">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
