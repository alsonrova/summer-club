import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!
}

function ratio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1! + 0.05) / (l2! + 0.05)
}

describe('contrastes de la charte', () => {
  const SAND = '#F7F3EE'
  it('le texte principal dépasse 4.5:1', () => {
    expect(ratio('#42392F', SAND)).toBeGreaterThan(4.5)
  })
  it('le texte secondaire dépasse 4.5:1', () => {
    expect(ratio('#6E6255', SAND)).toBeGreaterThan(4.5)
  })
  it('la sauge lisible dépasse 4.5:1', () => {
    expect(ratio('#5E6B55', SAND)).toBeGreaterThan(4.5)
  })
  it('le blanc sur sauge lisible dépasse 4.5:1', () => {
    expect(ratio('#FDFBF8', '#5E6B55')).toBeGreaterThan(4.5)
  })
  it('la sauge décorative reste sous 4.5:1 — elle ne doit pas servir de couleur de texte', () => {
    expect(ratio('#7C8B72', SAND)).toBeLessThan(4.5)
  })
  it('les tokens du fichier de charte sont ceux de la spec', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    expect(css).toContain('--color-sage-deep: #5E6B55')
    expect(css).toContain('--color-bark: #42392F')
  })
})
