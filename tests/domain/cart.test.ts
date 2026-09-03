import { describe, it, expect } from 'vitest'
import { computeTotals } from '@/domain/cart'

describe('computeTotals', () => {
  it('additionne les lignes', () => {
    const t = computeTotals(
      [{ variantId: 'a', unitPrice: 45000, quantity: 2 },
       { variantId: 'b', unitPrice: 30000, quantity: 1 }], 5000)
    expect(t.subtotal).toBe(120000)
  })
  it('ajoute les frais de livraison au total', () => {
    const t = computeTotals([{ variantId: 'a', unitPrice: 45000, quantity: 1 }], 5000)
    expect(t.total).toBe(50000)
  })
  it('un retrait en boutique n\'ajoute aucun frais', () => {
    const t = computeTotals([{ variantId: 'a', unitPrice: 45000, quantity: 1 }], 0)
    expect(t.shippingFee).toBe(0)
    expect(t.total).toBe(45000)
  })
  it('une zone non choisie compte zéro frais mais ne fait pas échouer le calcul', () => {
    const t = computeTotals([{ variantId: 'a', unitPrice: 45000, quantity: 1 }], null)
    expect(t.total).toBe(45000)
  })
  it('un panier vide donne un total nul', () => {
    expect(computeTotals([], 5000)).toEqual({
      subtotal: 0, shippingFee: 0, discount: 0, total: 0,
    })
  })
  it('tous les montants restent entiers', () => {
    const t = computeTotals([{ variantId: 'a', unitPrice: 33333, quantity: 3 }], 4500)
    expect(Number.isInteger(t.total)).toBe(true)
    expect(t.total).toBe(104499)
  })
})
