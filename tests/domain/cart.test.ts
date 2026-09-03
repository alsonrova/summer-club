import { describe, it, expect } from 'vitest'
import { computeTotals } from '@/domain/cart'

describe('computeTotals', () => {
  it('additionne les lignes', () => {
    const t = computeTotals(
      [{ variantId: 'a', prixUnitaire: 45000, quantite: 2 },
       { variantId: 'b', prixUnitaire: 30000, quantite: 1 }], 5000)
    expect(t.sousTotal).toBe(120000)
  })
  it('ajoute les frais de livraison au total', () => {
    const t = computeTotals([{ variantId: 'a', prixUnitaire: 45000, quantite: 1 }], 5000)
    expect(t.total).toBe(50000)
  })
  it('un retrait en boutique n\'ajoute aucun frais', () => {
    const t = computeTotals([{ variantId: 'a', prixUnitaire: 45000, quantite: 1 }], 0)
    expect(t.fraisLivraison).toBe(0)
    expect(t.total).toBe(45000)
  })
  it('une zone non choisie compte zéro frais mais ne fait pas échouer le calcul', () => {
    const t = computeTotals([{ variantId: 'a', prixUnitaire: 45000, quantite: 1 }], null)
    expect(t.total).toBe(45000)
  })
  it('un panier vide donne un total nul', () => {
    expect(computeTotals([], 5000)).toEqual({
      sousTotal: 0, fraisLivraison: 0, remise: 0, total: 0,
    })
  })
  it('tous les montants restent entiers', () => {
    const t = computeTotals([{ variantId: 'a', prixUnitaire: 33333, quantite: 3 }], 4500)
    expect(Number.isInteger(t.total)).toBe(true)
    expect(t.total).toBe(104499)
  })
})
