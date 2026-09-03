'use client'

import { useActionState } from 'react'
import type { ProductFormState } from './states'

type CategoryOption = { id: string; name: string }

function initialText(values: Record<string, unknown>, name: string): string {
  const v = values[name]
  return v === undefined || v === null ? '' : String(v)
}

// `idErreur`/`enErreur` relient le champ à son message via aria-describedby/aria-invalid —
// même câblage que InputField dans src/admin/engine/form.tsx, pour qu'un lecteur d'écran
// annonce l'erreur au moment où il atteint le champ, pas seulement quand elle apparaît
// visuellement.
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

// Formulaire produit hand-écrit (plutôt que le <AdminForm> générique du moteur,
// src/admin/engine/form.tsx) pour deux raisons propres à cette ressource : `categoryId` a
// besoin d'un vrai menu déroulant sur les catégories existantes (le moteur ne produit un
// <select> que pour un champ zod `enum`, pas pour une relation dont les valeurs viennent de
// la base), et les messages d'erreur doivent s'afficher sans rechargement complet via
// useActionState (React 19 / Next.js — voir node_modules/next/dist/docs/01-app/
// 01-getting-started/10-error-handling.md, section « Handling expected errors » : les
// erreurs de validation attendues sont modélisées comme des valeurs de retour, pas levées).
// La validation elle-même (`validateFormData(productsResource, ...)` dans actions.ts) reste
// celle du moteur, pilotée par le même schéma Zod.
//
// Volontairement sans attribut HTML `required` : la validation serveur (Zod, en français)
// est la seule source de vérité affichée. Un `required` natif bloquerait la soumission
// avant même d'atteindre le serveur, empêchant d'afficher les messages français dédiés en
// dessous de chaque champ.
export function ProductForm({
  action,
  initialState,
  categories,
  submitLabel,
}: {
  action: (previousState: ProductFormState, formData: FormData) => Promise<ProductFormState>
  initialState: ProductFormState
  categories: CategoryOption[]
  submitLabel: string
}) {
  const [state, submit, isPending] = useActionState(action, initialState)
  const v = state.initialValues

  const defaultCategoryId = initialText(v, 'categoryId') || (categories[0]?.id ?? '')
  const defaultCostPrice = initialText(v, 'costPrice') || '0'
  const defaultDisplayOrder = initialText(v, 'displayOrder') || '0'
  const defaultActive = v.active === undefined ? true : Boolean(v.active)

  const nameHasError = Boolean(state.errors.name?.length)
  const slugHasError = Boolean(state.errors.slug?.length)
  const descriptionHasError = Boolean(state.errors.description?.length)
  const categoryIdHasError = Boolean(state.errors.categoryId?.length)
  const basePriceHasError = Boolean(state.errors.basePrice?.length)
  const costPriceHasError = Boolean(state.errors.costPrice?.length)
  const displayOrderHasError = Boolean(state.errors.displayOrder?.length)

  return (
    <form action={submit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="produit-name" className="text-small text-bark-soft">
          Nom
        </label>
        <input
          id="produit-name"
          name="name"
          type="text"
          defaultValue={initialText(v, 'name')}
          aria-invalid={nameHasError || undefined}
          aria-describedby={nameHasError ? 'produit-name-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <FieldErrors id="produit-name-erreur" messages={state.errors.name} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-slug" className="text-small text-bark-soft">
          Slug
        </label>
        <input
          id="produit-slug"
          name="slug"
          type="text"
          defaultValue={initialText(v, 'slug')}
          aria-invalid={slugHasError || undefined}
          aria-describedby={slugHasError ? 'produit-slug-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <p className="text-small text-bark-soft">Minuscules, chiffres et tirets uniquement.</p>
        <FieldErrors id="produit-slug-erreur" messages={state.errors.slug} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-description" className="text-small text-bark-soft">
          Description
        </label>
        <textarea
          id="produit-description"
          name="description"
          rows={4}
          defaultValue={initialText(v, 'description')}
          aria-invalid={descriptionHasError || undefined}
          aria-describedby={descriptionHasError ? 'produit-description-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <FieldErrors id="produit-description-erreur" messages={state.errors.description} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-categoryId" className="text-small text-bark-soft">
          Catégorie
        </label>
        <select
          id="produit-categoryId"
          name="categoryId"
          defaultValue={defaultCategoryId}
          aria-invalid={categoryIdHasError || undefined}
          aria-describedby={categoryIdHasError ? 'produit-categoryId-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        >
          {categories.length === 0 ? <option value="">Aucune catégorie disponible</option> : null}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <FieldErrors id="produit-categoryId-erreur" messages={state.errors.categoryId} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-basePrice" className="text-small text-bark-soft">
          Prix
        </label>
        <input
          id="produit-basePrice"
          name="basePrice"
          type="number"
          defaultValue={initialText(v, 'basePrice')}
          aria-invalid={basePriceHasError || undefined}
          aria-describedby={basePriceHasError ? 'produit-basePrice-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <FieldErrors id="produit-basePrice-erreur" messages={state.errors.basePrice} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-costPrice" className="text-small text-bark-soft">
          Prix d&apos;achat
        </label>
        <input
          id="produit-costPrice"
          name="costPrice"
          type="number"
          defaultValue={defaultCostPrice}
          aria-invalid={costPriceHasError || undefined}
          aria-describedby={costPriceHasError ? 'produit-costPrice-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <FieldErrors id="produit-costPrice-erreur" messages={state.errors.costPrice} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-displayOrder" className="text-small text-bark-soft">
          Ordre d&apos;affichage
        </label>
        <input
          id="produit-displayOrder"
          name="displayOrder"
          type="number"
          defaultValue={defaultDisplayOrder}
          aria-invalid={displayOrderHasError || undefined}
          aria-describedby={displayOrderHasError ? 'produit-displayOrder-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <p className="text-small text-bark-soft">
          Détermine la position du produit dans la vitrine ; les valeurs les plus basses
          apparaissent en premier.
        </p>
        <FieldErrors id="produit-displayOrder-erreur" messages={state.errors.displayOrder} />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="produit-active"
          name="active"
          type="checkbox"
          defaultChecked={defaultActive}
          className="h-4 w-4 rounded border-taupe/40"
        />
        <label htmlFor="produit-active" className="text-small text-bark-soft">
          Actif (visible en boutique)
        </label>
      </div>

      {state.success ? (
        <p role="status" className="text-small text-bark-soft">
          Modifications enregistrées.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  )
}
