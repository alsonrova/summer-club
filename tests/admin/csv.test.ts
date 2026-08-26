import { describe, it, expect } from 'vitest'
import { versCSV } from '@/admin/engine/csv'

describe('versCSV', () => {
  it('écrit l\'en-tête puis les lignes', () => {
    const csv = versCSV([{ nom: 'Collier', prix: 45000 }], ['nom', 'prix'])
    expect(csv).toBe('nom,prix\r\nCollier,45000')
  })
  it('échappe les guillemets et les virgules', () => {
    const csv = versCSV([{ nom: 'Collier "or", fin' }], ['nom'])
    expect(csv).toBe('nom\r\n"Collier ""or"", fin"')
  })
  it('remplace les valeurs absentes par une chaîne vide', () => {
    expect(versCSV([{ nom: 'x' }], ['nom', 'prix'])).toBe('nom,prix\r\nx,')
  })
  it('préfixe les valeurs commençant par = pour bloquer l\'injection de formule', () => {
    const csv = versCSV([{ nom: '=1+1' }], ['nom'])
    expect(csv).toBe("nom\r\n'=1+1")
  })
})
