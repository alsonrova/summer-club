import { describe, it, expect } from 'vitest'
import { toCSV } from '@/admin/engine/csv'

describe('toCSV', () => {
  it('écrit l\'en-tête puis les lignes', () => {
    const csv = toCSV([{ nom: 'Collier', prix: 45000 }], ['nom', 'prix'])
    expect(csv).toBe('nom,prix\r\nCollier,45000')
  })
  it('échappe les guillemets et les virgules', () => {
    const csv = toCSV([{ nom: 'Collier "or", fin' }], ['nom'])
    expect(csv).toBe('nom\r\n"Collier ""or"", fin"')
  })
  it('remplace les valeurs absentes par une chaîne vide', () => {
    expect(toCSV([{ nom: 'x' }], ['nom', 'prix'])).toBe('nom,prix\r\nx,')
  })
  it('préfixe les valeurs commençant par = pour bloquer l\'injection de formule', () => {
    const csv = toCSV([{ nom: '=1+1' }], ['nom'])
    expect(csv).toBe("nom\r\n'=1+1")
  })
})
