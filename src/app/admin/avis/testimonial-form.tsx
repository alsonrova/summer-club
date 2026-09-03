'use client'

import { useActionState, useId } from 'react'
import type { TestimonialFormState } from './states'

function FieldErrors({ messages, id }: { messages: string[] | undefined; id: string }) {
  if (!messages || messages.length === 0) return null
  return (
    <p id={id} role="alert" className="text-small text-bark">
      {messages.join(' ')}
    </p>
  )
}

/**
 * Saisie d'un témoignage reçu hors du site. Aucun champ « source » : un témoignage saisi
 * ici est toujours `importe` (voir importTestimonial) — le badge « Achat vérifié » ne
 * s'obtient qu'en passant réellement commande.
 */
export function TestimonialForm({
  action,
  products,
}: {
  action: (
    previousState: TestimonialFormState,
    formData: FormData,
  ) => Promise<TestimonialFormState>
  products: { id: string; nom: string }[]
}) {
  const [state, submit, isPending] = useActionState<TestimonialFormState, FormData>(action, {
    success: false,
    errors: {},
    initialValues: {},
  })
  const prefix = useId()

  const value = (name: string) => {
    const v = state.initialValues[name]
    return v === undefined || v === null ? '' : String(v)
  }

  return (
    <form action={submit} className="flex flex-col gap-4 sm:max-w-xl">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-auteur`} className="text-small text-bark-soft">
          Autrice
        </label>
        <input
          id={`${prefix}-auteur`}
          name="auteur"
          type="text"
          defaultValue={value('auteur')}
          aria-invalid={state.errors['auteur'] ? true : undefined}
          aria-describedby={state.errors['auteur'] ? `${prefix}-auteur-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <FieldErrors messages={state.errors['auteur']} id={`${prefix}-auteur-erreur`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-note`} className="text-small text-bark-soft">
          Note
        </label>
        <select
          id={`${prefix}-note`}
          name="note"
          defaultValue={value('note') || '5'}
          aria-invalid={state.errors['note'] ? true : undefined}
          aria-describedby={state.errors['note'] ? `${prefix}-note-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
        <FieldErrors messages={state.errors['note']} id={`${prefix}-note-erreur`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-produit`} className="text-small text-bark-soft">
          Produit
        </label>
        <select
          id={`${prefix}-produit`}
          name="productId"
          defaultValue={value('productId')}
          aria-invalid={state.errors['productId'] ? true : undefined}
          aria-describedby={state.errors['productId'] ? `${prefix}-produit-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        >
          <option value="">Aucun produit en particulier</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.nom}
            </option>
          ))}
        </select>
        <FieldErrors messages={state.errors['productId']} id={`${prefix}-produit-erreur`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-texte`} className="text-small text-bark-soft">
          Témoignage
        </label>
        <textarea
          id={`${prefix}-texte`}
          name="texte"
          rows={3}
          defaultValue={value('texte')}
          aria-invalid={state.errors['texte'] ? true : undefined}
          aria-describedby={state.errors['texte'] ? `${prefix}-texte-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <FieldErrors messages={state.errors['texte']} id={`${prefix}-texte-erreur`} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? 'Enregistrement…' : 'Importer le témoignage'}
        </button>
        {state.success ? (
          <span role="status" className="text-small text-bark-soft">
            Témoignage importé.
          </span>
        ) : null}
      </div>
    </form>
  )
}
