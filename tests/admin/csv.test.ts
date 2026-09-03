import { describe, it, expect } from 'vitest'
import { toCSV } from '@/admin/engine/csv'

describe('toCSV', () => {
  it('écrit l\'en-tête puis les lignes', () => {
    const csv = toCSV([{ name: 'Collier', price: 45000 }], ['name', 'price'])
    expect(csv).toBe('name,price\r\nCollier,45000')
  })
  it('échappe les guillemets et les virgules', () => {
    const csv = toCSV([{ name: 'Collier "or", fin' }], ['name'])
    expect(csv).toBe('name\r\n"Collier ""or"", fin"')
  })
  it('remplace les valeurs absentes par une chaîne vide', () => {
    expect(toCSV([{ name: 'x' }], ['name', 'price'])).toBe('name,price\r\nx,')
  })
  it('préfixe les valeurs commençant par = pour bloquer l\'injection de formule', () => {
    const csv = toCSV([{ name: '=1+1' }], ['name'])
    expect(csv).toBe("name\r\n'=1+1")
  })
})
