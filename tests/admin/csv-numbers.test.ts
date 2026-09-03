import { describe, it, expect } from 'vitest'
import { toCSV } from '@/admin/engine/csv'

// Complète tests/admin/csv.test.ts (non modifié) : un nombre négatif bien formé
// (remise, avoir, ajustement de stock) n'est pas une formule de tableur et ne doit pas
// être préfixé, contrairement à tout ce qui ne fait que commencer par un signe.
describe('toCSV — nombres négatifs', () => {
  it('ne préfixe pas un entier négatif', () => {
    expect(toCSV([{ amount: '-5000' }], ['amount'])).toBe('amount\r\n-5000')
  })

  it('ne préfixe pas un décimal négatif', () => {
    expect(toCSV([{ amount: '-12.5' }], ['amount'])).toBe('amount\r\n-12.5')
  })

  it("préfixe '-1+1' (pas un nombre bien formé)", () => {
    expect(toCSV([{ amount: '-1+1' }], ['amount'])).toBe("amount\r\n'-1+1")
  })

  it("préfixe '--5000' (pas un nombre bien formé)", () => {
    expect(toCSV([{ amount: '--5000' }], ['amount'])).toBe("amount\r\n'--5000")
  })

  it("préfixe '-' seul", () => {
    expect(toCSV([{ amount: '-' }], ['amount'])).toBe("amount\r\n'-")
  })

  it("préfixe toujours '=1+1'", () => {
    expect(toCSV([{ amount: '=1+1' }], ['amount'])).toBe("amount\r\n'=1+1")
  })
})
