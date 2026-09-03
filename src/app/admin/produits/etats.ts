import type { ValidationErrors } from '@/admin/engine/actions'

// Séparé de actions.ts : un fichier marqué 'use server' ne peut exporter que des fonctions
// async (voir https://nextjs.org/docs/messages/invalid-use-server-value, rencontré en
// tentant d'y exporter ces constantes directement) — ces types et leurs valeurs initiales
// sont pourtant nécessaires aussi bien aux Server Actions (comme forme de retour) qu'aux
// composants client qui les invoquent via useActionState (comme état initial).

export type ProductFormState = {
  success: boolean
  errors: ValidationErrors
  initialValues: Record<string, unknown>
}

export const initialProductFormState: ProductFormState = {
  success: false,
  errors: {},
  initialValues: {},
}

export type SimpleActionState = {
  error: string | null
}

export const initialSimpleActionState: SimpleActionState = { error: null }

// Même forme que ProductFormState ci-dessus (succès, erreurs par champ, valeurs à
// restituer) : le formulaire de création de déclinaison (formulaire-declinaison.tsx) suit
// le même patron useActionState que ProductForm, sur son propre schéma.
export type VariantFormState = {
  success: boolean
  errors: ValidationErrors
  initialValues: Record<string, unknown>
}

export const initialVariantFormState: VariantFormState = {
  success: false,
  errors: {},
  initialValues: {},
}
