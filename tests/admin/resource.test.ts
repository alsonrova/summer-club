import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { defineResource } from '@/admin/resource'

const schema = z.object({ nom: z.string().min(1), prix: z.number().int().positive() })

describe('defineResource', () => {
  it('conserve les colonnes déclarées', () => {
    const r = defineResource({ name: 'produits', label: 'Produits', schema, columns: ['nom', 'prix'] })
    expect(r.columns).toEqual(['nom', 'prix'])
  })
  it('refuse une colonne absente du schéma', () => {
    expect(() => defineResource({
      name: 'produits', label: 'Produits', schema, columns: ['inexistant' as never],
    })).toThrow(/inexistant/)
  })
  it('expose les champs du schéma pour la génération de formulaire', () => {
    const r = defineResource({ name: 'produits', label: 'Produits', schema, columns: ['nom'] })
    expect(r.fields.map((f) => f.name)).toEqual(['nom', 'prix'])
    expect(r.fields.find((f) => f.name === 'prix')?.kind).toBe('number')
  })
})
