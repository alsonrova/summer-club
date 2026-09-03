import type { ValidationErrors } from '@/admin/engine/actions'

// Séparé de actions.ts : un fichier marqué 'use server' ne peut exporter que des fonctions
// async (https://nextjs.org/docs/messages/invalid-use-server-value).

export type TestimonialFormState = {
  success: boolean
  errors: ValidationErrors
  initialValues: Record<string, unknown>
}

export const initialTestimonialFormState: TestimonialFormState = {
  success: false,
  errors: {},
  initialValues: {},
}

export type ReviewActionState = {
  error: string | null
}

export const initialReviewActionState: ReviewActionState = { error: null }
