import { z } from 'zod'
import { defineResource } from '@/admin/resource'

// Bornes d'un entier PostgreSQL (colonnes `Int` du schéma Prisma) : au-delà, l'écriture
// lèverait une erreur Prisma non gérée plutôt qu'un message de validation en français.
const ENTIER_POSTGRES_MAX = 2147483647
const ENTIER_POSTGRES_MIN = -2147483648

export const variantSchema = z.object({
  libelle: z.string().min(1, 'Le libellé est requis'),
  sku: z
    .string()
    .regex(/^[A-Za-z0-9-]+$/, 'Lettres, chiffres et tirets uniquement')
    .min(1, 'Le SKU est requis'),
  // Un écart de prix, pas un prix : peut être négatif (une déclinaison moins chère que le
  // prix de base, ex. une taille enfant) aussi bien que positif.
  deltaPrix: z.number().int().min(ENTIER_POSTGRES_MIN).max(ENTIER_POSTGRES_MAX),
  stock: z.number().int().min(0, 'Le stock doit être positif ou nul').max(ENTIER_POSTGRES_MAX),
})

export type VariantInput = z.infer<typeof variantSchema>

// Ressource utilisée uniquement pour sa validation (`validerFormData`/`formDataVersObjet`,
// voir src/admin/engine/actions.ts) — le formulaire de création de déclinaison est hand-
// écrit (comme celui du produit, voir formulaire-produit.tsx), pas rendu par <AdminTable>.
// `columns` doit néanmoins référencer des clés réelles du schéma (defineResource le
// vérifie) ; ces colonnes ne sont affichées nulle part.
export const variantsResource = defineResource<VariantInput>({
  name: 'declinaisons',
  label: 'Déclinaisons',
  schema: variantSchema,
  columns: ['libelle', 'sku', 'stock'],
  libelles: {
    deltaPrix: 'Écart de prix',
  },
})
