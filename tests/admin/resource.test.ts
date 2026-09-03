import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { defineResource } from '@/admin/resource'
import { productsResource } from '@/admin/resources/products'
import { variantsResource } from '@/admin/resources/variants'

const schema = z.object({ name: z.string().min(1), price: z.number().int().positive() })

describe('defineResource', () => {
  it('conserve les colonnes déclarées', () => {
    const r = defineResource({ name: 'products', label: 'Produits', schema, columns: ['name', 'price'] })
    expect(r.columns).toEqual(['name', 'price'])
  })
  it('refuse une colonne absente du schéma', () => {
    expect(() => defineResource({
      name: 'products', label: 'Produits', schema, columns: ['inexistant' as never],
    })).toThrow(/inexistant/)
  })
  it('expose les champs du schéma pour la génération de formulaire', () => {
    const r = defineResource({ name: 'products', label: 'Produits', schema, columns: ['name'] })
    expect(r.fields.map((f) => f.name)).toEqual(['name', 'price'])
    expect(r.fields.find((f) => f.name === 'price')?.kind).toBe('number')
  })
})

// Le renommage des clés de schéma (docs/RENOMMAGE.md § 2) a fait glisser la dérivation
// automatique des libellés (capitalize(name)) vers l'anglais dès que la clé elle-même est
// devenue anglaise : "nom" -> "Nom" (français) mais "name" -> "Name" (anglais). Les
// libellés affichés à la propriétaire doivent rester identiques à ce qu'ils étaient avant
// le renommage (docs/CONVENTIONS.md § 1 : « le renommage ne touche aucun libellé »),
// via des surcharges explicites dans `labels`.
describe('libellés dérivés — identiques à ceux d\'avant le renommage', () => {
  it("productsResource affiche des libellés français malgré des clés de schéma anglaises", () => {
    const byName = new Map(productsResource.fields.map((f) => [f.name, f.label]))
    expect(byName.get('name')).toBe('Nom')
    expect(byName.get('active')).toBe('Actif')
    expect(byName.get('displayOrder')).toBe('Ordre')
  })

  it("variantsResource affiche des libellés français malgré des clés de schéma anglaises", () => {
    const byName = new Map(variantsResource.fields.map((f) => [f.name, f.label]))
    expect(byName.get('label')).toBe('Libellé')
  })
})
