import { describe, it, expect } from 'vitest'
import { resolvePrix } from '@/domain/pricing'
import type { PromotionRule } from '@/domain/types'

const base = (o: Partial<PromotionRule> = {}): PromotionRule => ({
  id: 'p1', type: 'percent', valeur: 20, portee: 'tout', cibleId: null,
  debut: null, fin: null, joursSemaine: 127, heureDebut: null, heureFin: null,
  membresSeulement: false, priorite: 0, actif: true, ...o,
})

// 2026-08-14 est un vendredi. 20h00 à Antananarivo = 17h00 UTC.
const VENDREDI_20H = new Date('2026-08-14T17:00:00Z')
const VENDREDI_23H = new Date('2026-08-14T20:00:00Z')
const args = (p: PromotionRule[], maintenant = VENDREDI_20H, estMembre = false) => ({
  prixBase: 50000, productId: 'prod1', categoryId: 'cat1',
  promotions: p, maintenant, estMembre,
})

describe('resolvePrix', () => {
  it('sans promotion, le prix de base est retourné', () => {
    expect(resolvePrix(args([]))).toEqual({
      prixInitial: 50000, prixFinal: 50000, promotionId: null,
    })
  })

  it('applique une remise en pourcentage', () => {
    expect(resolvePrix(args([base()])).prixFinal).toBe(40000)
  })

  it('applique une remise en montant fixe', () => {
    expect(resolvePrix(args([base({ type: 'fixed', valeur: 5000 })])).prixFinal).toBe(45000)
  })

  it('ignore une promotion inactive', () => {
    expect(resolvePrix(args([base({ actif: false })])).prixFinal).toBe(50000)
  })

  it('ignore une promotion dont la fenêtre de dates est passée', () => {
    const p = base({ debut: new Date('2026-01-01'), fin: new Date('2026-02-01') })
    expect(resolvePrix(args([p])).prixFinal).toBe(50000)
  })

  it('applique une promotion dont la fenêtre de dates est courante', () => {
    const p = base({ debut: new Date('2026-08-01'), fin: new Date('2026-09-01') })
    expect(resolvePrix(args([p])).prixFinal).toBe(40000)
  })

  it('applique un happy hour pendant sa plage horaire', () => {
    const p = base({ heureDebut: 20, heureFin: 22 })
    expect(resolvePrix(args([p], VENDREDI_20H)).prixFinal).toBe(40000)
  })

  it('ignore un happy hour en dehors de sa plage horaire', () => {
    const p = base({ heureDebut: 20, heureFin: 22 })
    expect(resolvePrix(args([p], VENDREDI_23H)).prixFinal).toBe(50000)
  })

  it('ignore un happy hour un jour non couvert par le masque', () => {
    // masque lundi seulement = bit 0
    const p = base({ heureDebut: 20, heureFin: 22, joursSemaine: 0b0000001 })
    expect(resolvePrix(args([p], VENDREDI_20H)).prixFinal).toBe(50000)
  })

  it('ignore une promotion membre pour un visiteur non connecté', () => {
    expect(resolvePrix(args([base({ membresSeulement: true })])).prixFinal).toBe(50000)
  })

  it('applique une promotion membre pour un membre', () => {
    expect(resolvePrix(args([base({ membresSeulement: true })], VENDREDI_20H, true)).prixFinal).toBe(40000)
  })

  it('ignore une promotion ciblant un autre produit', () => {
    const p = base({ portee: 'produit', cibleId: 'autre' })
    expect(resolvePrix(args([p])).prixFinal).toBe(50000)
  })

  it('applique une promotion ciblant la bonne catégorie', () => {
    const p = base({ portee: 'categorie', cibleId: 'cat1' })
    expect(resolvePrix(args([p])).prixFinal).toBe(40000)
  })

  it('ne cumule jamais deux promotions : la plus prioritaire gagne', () => {
    const faible = base({ id: 'faible', valeur: 10, priorite: 1 })
    const forte = base({ id: 'forte', valeur: 30, priorite: 5 })
    const r = resolvePrix(args([faible, forte]))
    expect(r.prixFinal).toBe(35000)
    expect(r.promotionId).toBe('forte')
  })

  it('à priorité égale, la remise la plus avantageuse pour la cliente gagne', () => {
    const a = base({ id: 'a', valeur: 10 })
    const b = base({ id: 'b', valeur: 25 })
    expect(resolvePrix(args([a, b])).promotionId).toBe('b')
  })

  it('ne descend jamais sous zéro', () => {
    expect(resolvePrix(args([base({ type: 'fixed', valeur: 999999 })])).prixFinal).toBe(0)
  })
})
