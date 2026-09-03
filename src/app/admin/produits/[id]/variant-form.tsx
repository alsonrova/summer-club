'use client'

import { useActionState } from 'react'
import type { VariantFormState } from '../states'
import { formatAriary } from '@/domain/money'

function initialText(values: Record<string, unknown>, name: string): string {
  const v = values[name]
  return v === undefined || v === null ? '' : String(v)
}

function FieldErrors({ id, messages }: { id: string; messages: string[] | undefined }) {
  if (!messages?.length) return null
  return (
    <div id={id}>
      {messages.map((message) => (
        <p key={message} role="alert" className="text-small text-bark">
          {message}
        </p>
      ))}
    </div>
  )
}

// Formulaire hand-écrit, dans le même esprit que ProductForm (../product-form.tsx) :
// validation serveur seule source de vérité (pas de `required` HTML),
// messages d'erreur affichés sans rechargement via useActionState. `basePrice` sert
// uniquement à rappeler le calcul déjà affiché dans le tableau des déclinaisons
// existantes ; l'action serveur (createVariant) revalide ce même calcul, ce texte
// n'est qu'indicatif.
export function VariantForm({
  action,
  basePrice,
}: {
  action: (
    previousState: VariantFormState,
    formData: FormData,
  ) => Promise<VariantFormState>
  basePrice: number
}) {
  const [state, submit, isPending] = useActionState(action, {
    success: false,
    errors: {},
    initialValues: {},
  })
  const v = state.initialValues

  const labelHasError = Boolean(state.errors.label?.length)
  const skuHasError = Boolean(state.errors.sku?.length)
  const priceDeltaHasError = Boolean(state.errors.priceDelta?.length)
  const stockHasError = Boolean(state.errors.stock?.length)

  return (
    <form action={submit} className="mt-4 flex max-w-lg flex-col gap-4">
      <h3 className="font-display text-lg font-light text-bark">Nouvelle déclinaison</h3>

      <div className="flex flex-col gap-1">
        <label htmlFor="declinaison-label" className="text-small text-bark-soft">
          Libellé
        </label>
        <input
          id="declinaison-label"
          name="label"
          type="text"
          defaultValue={initialText(v, 'label')}
          aria-invalid={labelHasError || undefined}
          aria-describedby={labelHasError ? 'declinaison-label-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <FieldErrors id="declinaison-label-erreur" messages={state.errors.label} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="declinaison-sku" className="text-small text-bark-soft">
          SKU
        </label>
        <input
          id="declinaison-sku"
          name="sku"
          type="text"
          defaultValue={initialText(v, 'sku')}
          aria-invalid={skuHasError || undefined}
          aria-describedby={skuHasError ? 'declinaison-sku-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <p className="text-small text-bark-soft">Lettres, chiffres et tirets uniquement.</p>
        <FieldErrors id="declinaison-sku-erreur" messages={state.errors.sku} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="declinaison-priceDelta" className="text-small text-bark-soft">
          Écart de prix
        </label>
        <input
          id="declinaison-priceDelta"
          name="priceDelta"
          type="number"
          defaultValue={initialText(v, 'priceDelta') || '0'}
          aria-invalid={priceDeltaHasError || undefined}
          aria-describedby={priceDeltaHasError ? 'declinaison-priceDelta-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <p className="text-small text-bark-soft">
          Ajouté au prix de base ({formatAriary(basePrice)}) ; peut être négatif. Le résultat
          doit rester positif.
        </p>
        <FieldErrors id="declinaison-priceDelta-erreur" messages={state.errors.priceDelta} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="declinaison-stock" className="text-small text-bark-soft">
          Stock
        </label>
        <input
          id="declinaison-stock"
          name="stock"
          type="number"
          defaultValue={initialText(v, 'stock') || '0'}
          aria-invalid={stockHasError || undefined}
          aria-describedby={stockHasError ? 'declinaison-stock-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <FieldErrors id="declinaison-stock-erreur" messages={state.errors.stock} />
      </div>

      {state.success ? (
        <p role="status" className="text-small text-bark-soft">
          Déclinaison créée.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90 disabled:opacity-60"
      >
        Ajouter la déclinaison
      </button>
    </form>
  )
}
