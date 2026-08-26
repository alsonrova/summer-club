import { z } from 'zod'
import { defineResource } from '@/admin/resource'

export const productSchema = z.object({
  nom: z.string().min(2, 'Le nom est requis'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Minuscules, chiffres et tirets uniquement'),
  description: z.string().min(10, 'Décrivez le produit en une phrase au moins'),
  categoryId: z.string().min(1, 'Choisissez une catégorie'),
  prixBase: z.number().int().positive('Le prix doit être positif'),
  prixAchat: z.number().int().min(0),
  actif: z.boolean(),
})

export type ProductInput = z.infer<typeof productSchema>

// `actions` reste vide : ni duplication (hors périmètre, voir le brief de la tâche 11), ni
// export CSV câblé à un bouton dans cette tâche — versCSV existe (tâche 10) mais aucun
// écran ne l'invoque encore. AdminTable/AdminForm ne lisent d'ailleurs pas ce champ ; il ne
// documenterait que des fonctionnalités non livrées si on le remplissait par anticipation.
export const productsResource = defineResource<ProductInput>({
  name: 'produits',
  label: 'Produits',
  schema: productSchema,
  columns: ['nom', 'categoryId', 'prixBase', 'actif'],
  filters: ['categoryId', 'actif'],
  actions: [],
  libelles: {
    prixBase: 'Prix',
    prixAchat: "Prix d'achat",
    categoryId: 'Catégorie',
  },
})
