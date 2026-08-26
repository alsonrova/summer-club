import { z } from 'zod'
import { defineResource } from '@/admin/resource'

// 2147483647 = la borne haute d'un entier PostgreSQL (colonnes `Int` du schéma Prisma) :
// sans cette borne, `z.number().int().positive()` laisse passer des valeurs qu'une colonne
// `Int` refuse à l'écriture, ce qui lève une erreur Prisma non gérée au lieu d'un message
// de validation.
const ENTIER_POSTGRES_MAX = 2147483647

export const productSchema = z.object({
  nom: z.string().min(2, 'Le nom est requis'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Minuscules, chiffres et tirets uniquement'),
  description: z.string().min(10, 'Décrivez le produit en une phrase au moins'),
  categoryId: z.string().min(1, 'Choisissez une catégorie'),
  prixBase: z.number().int().positive('Le prix doit être positif').max(ENTIER_POSTGRES_MAX),
  prixAchat: z.number().int().min(0).max(ENTIER_POSTGRES_MAX),
  actif: z.boolean(),
  // Sert au tri de la vitrine (voir query.ts) : sans ce champ, tout produit créé depuis
  // l'interface hérite de la même valeur par défaut (0) que la colonne Prisma, rendant la
  // propriétaire incapable d'ordonner son catalogue.
  ordre: z.number().int().min(0).max(ENTIER_POSTGRES_MAX),
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
