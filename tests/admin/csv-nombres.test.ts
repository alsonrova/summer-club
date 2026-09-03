import { describe, it, expect } from 'vitest'
import { toCSV } from '@/admin/engine/csv'

// Complète tests/admin/csv.test.ts (non modifié) : un nombre négatif bien formé
// (remise, avoir, ajustement de stock) n'est pas une formule de tableur et ne doit pas
// être préfixé, contrairement à tout ce qui ne fait que commencer par un signe.
describe('toCSV — nombres négatifs', () => {
  it('ne préfixe pas un entier négatif', () => {
    expect(toCSV([{ montant: '-5000' }], ['montant'])).toBe('montant\r\n-5000')
  })

  it('ne préfixe pas un décimal négatif', () => {
    expect(toCSV([{ montant: '-12.5' }], ['montant'])).toBe('montant\r\n-12.5')
  })

  it("préfixe '-1+1' (pas un nombre bien formé)", () => {
    expect(toCSV([{ montant: '-1+1' }], ['montant'])).toBe("montant\r\n'-1+1")
  })

  it("préfixe '--5000' (pas un nombre bien formé)", () => {
    expect(toCSV([{ montant: '--5000' }], ['montant'])).toBe("montant\r\n'--5000")
  })

  it("préfixe '-' seul", () => {
    expect(toCSV([{ montant: '-' }], ['montant'])).toBe("montant\r\n'-")
  })

  it("préfixe toujours '=1+1'", () => {
    expect(toCSV([{ montant: '=1+1' }], ['montant'])).toBe("montant\r\n'=1+1")
  })
})
