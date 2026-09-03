import { z } from 'zod'
import { defineResource } from '@/admin/resource'

// 2147483647 = la borne haute d'un entier PostgreSQL (colonnes `Int` du schéma Prisma) :
// sans cette borne, `z.number().int().positive()` laisse passer des valeurs qu'une colonne
// `Int` refuse à l'écriture, ce qui lève une erreur Prisma non gérée au lieu d'un message
// de validation.
const POSTGRES_INT_MAX = 2147483647

export const productSchema = z.object({
  // .trim() avant .min(2) : le texte alternatif de départ d'une photo est dérivé du nom du
  // produit (voir uploadMedia), et updateMediaAlt refuse un alt vide ou fait
  // d'espaces. Sans ce trim, un nom de deux espaces passait la validation et fabriquait
  // exactement l'état interdit qu'on prétend fermer.
  name: z.string().trim().min(2, 'Le nom est requis'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Minuscules, chiffres et tirets uniquement'),
  description: z.string().min(10, 'Décrivez le produit en une phrase au moins'),
  categoryId: z.string().min(1, 'Choisissez une catégorie'),
  basePrice: z.number().int().positive('Le prix doit être positif').max(POSTGRES_INT_MAX),
  costPrice: z.number().int().min(0).max(POSTGRES_INT_MAX),
  active: z.boolean(),
  // Sert au tri de la vitrine (voir query.ts) : sans ce champ, tout produit créé depuis
  // l'interface hérite de la même valeur par défaut (0) que la colonne Prisma, rendant la
  // propriétaire incapable d'ordonner son catalogue.
  displayOrder: z.number().int().min(0).max(POSTGRES_INT_MAX),
})

export type ProductInput = z.infer<typeof productSchema>

// `actions` reste vide : ni duplication (hors périmètre, voir le brief de la tâche 11), ni
// export CSV câblé à un bouton dans cette tâche — toCSV existe (tâche 10) mais aucun
// écran ne l'invoque encore. AdminTable/AdminForm ne lisent d'ailleurs pas ce champ ; il ne
// documenterait que des fonctionnalités non livrées si on le remplissait par anticipation.
export const productsResource = defineResource<ProductInput>({
  name: 'products',
  label: 'Produits',
  schema: productSchema,
  columns: ['name', 'categoryId', 'basePrice', 'active'],
  filters: ['categoryId', 'active'],
  actions: [],
  labels: {
    name: 'Nom',
    basePrice: 'Prix',
    costPrice: "Prix d'achat",
    categoryId: 'Catégorie',
    active: 'Actif',
    displayOrder: 'Ordre',
  },
})
