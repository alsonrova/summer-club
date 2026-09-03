import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { defineResource } from '@/admin/resource'

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
