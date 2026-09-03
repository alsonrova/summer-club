import { describe, it, expect } from 'vitest'
import { formatAriary, applyPercentage } from '@/domain/money'

describe('formatAriary', () => {
  it('groupe les milliers avec une espace insécable', () => {
    expect(formatAriary(45000)).toBe('45\u00A0000\u00A0Ar')
  })
  it("n'affiche aucune décimale", () => {
    expect(formatAriary(1500)).toBe('1\u00A0500\u00A0Ar')
  })
  it('gère zéro', () => {
    expect(formatAriary(0)).toBe('0\u00A0Ar')
  })
  it('gère les grands montants', () => {
    expect(formatAriary(1250000)).toBe('1\u00A0250\u00A0000\u00A0Ar')
  })
})

describe('applyPercentage', () => {
  it('retourne un entier', () => {
    expect(Number.isInteger(applyPercentage(45000, 15))).toBe(true)
  })
  it("arrondit à l'entier le plus proche", () => {
    expect(applyPercentage(999, 10)).toBe(899)
  })
  it('ne descend jamais sous zéro', () => {
    expect(applyPercentage(1000, 150)).toBe(0)
  })
  it('un pourcentage nul ne change rien', () => {
    expect(applyPercentage(45000, 0)).toBe(45000)
  })
})
