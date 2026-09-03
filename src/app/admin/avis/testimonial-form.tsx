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
 * ici est toujours `imported` (voir importTestimonial) — le badge « Achat vérifié » ne
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
  products: { id: string; name: string }[]
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
        <label htmlFor={`${prefix}-author`} className="text-small text-bark-soft">
          Autrice
        </label>
        <input
          id={`${prefix}-author`}
          name="author"
          type="text"
          defaultValue={value('author')}
          aria-invalid={state.errors['author'] ? true : undefined}
          aria-describedby={state.errors['author'] ? `${prefix}-author-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <FieldErrors messages={state.errors['author']} id={`${prefix}-author-erreur`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-rating`} className="text-small text-bark-soft">
          Note
        </label>
        <select
          id={`${prefix}-rating`}
          name="rating"
          defaultValue={value('rating') || '5'}
          aria-invalid={state.errors['rating'] ? true : undefined}
          aria-describedby={state.errors['rating'] ? `${prefix}-rating-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
        <FieldErrors messages={state.errors['rating']} id={`${prefix}-rating-erreur`} />
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
              {product.name}
            </option>
          ))}
        </select>
        <FieldErrors messages={state.errors['productId']} id={`${prefix}-produit-erreur`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-body`} className="text-small text-bark-soft">
          Témoignage
        </label>
        <textarea
          id={`${prefix}-body`}
          name="body"
          rows={3}
          defaultValue={value('body')}
          aria-invalid={state.errors['body'] ? true : undefined}
          aria-describedby={state.errors['body'] ? `${prefix}-body-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <FieldErrors messages={state.errors['body']} id={`${prefix}-body-erreur`} />
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
