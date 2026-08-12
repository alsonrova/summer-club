import { describe, it, expect } from 'vitest'
import { formatAriary, appliquerPourcentage } from '@/domain/money'

describe('formatAriary', () => {
  it('groupe les milliers avec une espace insécable', () => {
    expect(formatAriary(45000)).toBe('45 000 Ar')
  })
  it("n'affiche aucune décimale", () => {
    expect(formatAriary(1500)).toBe('1 500 Ar')
  })
  it('gère zéro', () => {
    expect(formatAriary(0)).toBe('0 Ar')
  })
  it('gère les grands montants', () => {
    expect(formatAriary(1250000)).toBe('1 250 000 Ar')
  })
})

describe('appliquerPourcentage', () => {
  it('retourne un entier', () => {
    expect(Number.isInteger(appliquerPourcentage(45000, 15))).toBe(true)
  })
  it("arrondit à l'entier le plus proche", () => {
    expect(appliquerPourcentage(999, 10)).toBe(899)
  })
  it('ne descend jamais sous zéro', () => {
    expect(appliquerPourcentage(1000, 150)).toBe(0)
  })
  it('un pourcentage nul ne change rien', () => {
    expect(appliquerPourcentage(45000, 0)).toBe(45000)
  })
})
