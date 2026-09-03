import { describe, it, expect } from 'vitest'
import { resolvePrice } from '@/domain/pricing'
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

describe('resolvePrice', () => {
  it('sans promotion, le prix de base est retourné', () => {
    expect(resolvePrice(args([]))).toEqual({
      prixInitial: 50000, prixFinal: 50000, promotionId: null,
    })
  })

  it('applique une remise en pourcentage', () => {
    expect(resolvePrice(args([base()])).prixFinal).toBe(40000)
  })

  it('applique une remise en montant fixe', () => {
    expect(resolvePrice(args([base({ type: 'fixed', valeur: 5000 })])).prixFinal).toBe(45000)
  })

  it('ignore une promotion inactive', () => {
    expect(resolvePrice(args([base({ actif: false })])).prixFinal).toBe(50000)
  })

  it('ignore une promotion dont la fenêtre de dates est passée', () => {
    const p = base({ debut: new Date('2026-01-01'), fin: new Date('2026-02-01') })
    expect(resolvePrice(args([p])).prixFinal).toBe(50000)
  })

  it('applique une promotion dont la fenêtre de dates est courante', () => {
    const p = base({ debut: new Date('2026-08-01'), fin: new Date('2026-09-01') })
    expect(resolvePrice(args([p])).prixFinal).toBe(40000)
  })

  it('applique un happy hour pendant sa plage horaire', () => {
    const p = base({ heureDebut: 20, heureFin: 22 })
    expect(resolvePrice(args([p], VENDREDI_20H)).prixFinal).toBe(40000)
  })

  it('ignore un happy hour en dehors de sa plage horaire', () => {
    const p = base({ heureDebut: 20, heureFin: 22 })
    expect(resolvePrice(args([p], VENDREDI_23H)).prixFinal).toBe(50000)
  })

  it('ignore un happy hour un jour non couvert par le masque', () => {
    // masque lundi seulement = bit 0
    const p = base({ heureDebut: 20, heureFin: 22, joursSemaine: 0b0000001 })
    expect(resolvePrice(args([p], VENDREDI_20H)).prixFinal).toBe(50000)
  })

  it('ignore une promotion membre pour un visiteur non connecté', () => {
    expect(resolvePrice(args([base({ membresSeulement: true })])).prixFinal).toBe(50000)
  })

  it('applique une promotion membre pour un membre', () => {
    expect(resolvePrice(args([base({ membresSeulement: true })], VENDREDI_20H, true)).prixFinal).toBe(40000)
  })

  it('ignore une promotion ciblant un autre produit', () => {
    const p = base({ portee: 'produit', cibleId: 'autre' })
    expect(resolvePrice(args([p])).prixFinal).toBe(50000)
  })

  it('applique une promotion ciblant la bonne catégorie', () => {
    const p = base({ portee: 'categorie', cibleId: 'cat1' })
    expect(resolvePrice(args([p])).prixFinal).toBe(40000)
  })

  it('ne cumule jamais deux promotions : la plus prioritaire gagne', () => {
    const faible = base({ id: 'faible', valeur: 10, priorite: 1 })
    const forte = base({ id: 'forte', valeur: 30, priorite: 5 })
    const r = resolvePrice(args([faible, forte]))
    expect(r.prixFinal).toBe(35000)
    expect(r.promotionId).toBe('forte')
  })

  it('à priorité égale, la remise la plus avantageuse pour la cliente gagne', () => {
    const a = base({ id: 'a', valeur: 10 })
    const b = base({ id: 'b', valeur: 25 })
    expect(resolvePrice(args([a, b])).promotionId).toBe('b')
  })

  it('ne descend jamais sous zéro', () => {
    expect(resolvePrice(args([base({ type: 'fixed', valeur: 999999 })])).prixFinal).toBe(0)
  })
})

describe('resolvePrice — robustesse fuseau et fenêtres horaires', () => {
  // 2026-08-14 est un vendredi, 2026-08-15 un samedi.
  // Antananarivo = UTC+3 toute l'année (pas d'heure d'été/hiver).

  it('applique un happy hour qui franchit minuit, à l\'intérieur de la plage', () => {
    const p = base({ heureDebut: 22, heureFin: 2 })
    // 23h00 à Antananarivo (vendredi) = 20h00 UTC (vendredi).
    const vendredi23h = new Date('2026-08-14T20:00:00Z')
    expect(resolvePrice(args([p], vendredi23h)).prixFinal).toBe(40000)

    // 0h30 à Antananarivo (samedi) = 21h30 UTC (vendredi).
    const samedi0h30 = new Date('2026-08-14T21:30:00Z')
    expect(resolvePrice(args([p], samedi0h30)).prixFinal).toBe(40000)
  })

  it('ignore un happy hour qui franchit minuit, en dehors de la plage', () => {
    const p = base({ heureDebut: 22, heureFin: 2 })
    // 21h00 à Antananarivo (vendredi) = 18h00 UTC (vendredi).
    const vendredi21h = new Date('2026-08-14T18:00:00Z')
    expect(resolvePrice(args([p], vendredi21h)).prixFinal).toBe(50000)

    // 2h00 à Antananarivo (samedi) = 23h00 UTC (vendredi).
    const samedi2h = new Date('2026-08-14T23:00:00Z')
    expect(resolvePrice(args([p], samedi2h)).prixFinal).toBe(50000)
  })

  it('applique une promotion pile à minuit heure locale (heure = 0, pas 24)', () => {
    const p = base({ heureDebut: 0, heureFin: 6 })
    // 0h00 à Antananarivo (samedi) = 21h00 UTC (vendredi).
    const samediMinuit = new Date('2026-08-14T21:00:00Z')
    expect(resolvePrice(args([p], samediMinuit)).prixFinal).toBe(40000)
  })

  it('ne s\'applique jamais si seule une borne de la plage horaire est renseignée', () => {
    const debutSeul = base({ heureDebut: 20, heureFin: null })
    const finSeule = base({ heureDebut: null, heureFin: 22 })
    // 20h00 à Antananarivo (vendredi) = 17h00 UTC (vendredi).
    const vendredi20h = new Date('2026-08-14T17:00:00Z')
    expect(resolvePrice(args([debutSeul], vendredi20h)).prixFinal).toBe(50000)
    expect(resolvePrice(args([finSeule], vendredi20h)).prixFinal).toBe(50000)
  })

  it('la plage horaire normale est inclusive au début et exclusive à la fin', () => {
    const p = base({ heureDebut: 20, heureFin: 22 })
    // 20h00 à Antananarivo (vendredi) = 17h00 UTC (vendredi) : borne de début, appliquée.
    const vendredi20h = new Date('2026-08-14T17:00:00Z')
    expect(resolvePrice(args([p], vendredi20h)).prixFinal).toBe(40000)

    // 22h00 à Antananarivo (vendredi) = 19h00 UTC (vendredi) : borne de fin, non appliquée.
    const vendredi22h = new Date('2026-08-14T19:00:00Z')
    expect(resolvePrice(args([p], vendredi22h)).prixFinal).toBe(50000)
  })

  it('scénario combiné : une seule des trois promotions simultanées s\'applique', () => {
    const promoProduit = base({
      id: 'promoProduit', portee: 'produit', cibleId: 'prod1', priorite: 1, valeur: 10,
    })
    const promoCategorieHorsHeure = base({
      id: 'promoCategorieHorsHeure', portee: 'categorie', cibleId: 'cat1',
      heureDebut: 9, heureFin: 18, priorite: 10, valeur: 80,
    })
    const promoHappyHour = base({
      id: 'promoHappyHour', portee: 'tout', heureDebut: 19, heureFin: 21, priorite: 5, valeur: 30,
    })
    // 20h00 à Antananarivo (vendredi) = 17h00 UTC (vendredi).
    const vendredi20h = new Date('2026-08-14T17:00:00Z')
    const r = resolvePrice(
      args([promoProduit, promoCategorieHorsHeure, promoHappyHour], vendredi20h),
    )
    // promoCategorieHorsHeure a la priorité la plus haute mais n'est pas dans sa
    // plage horaire (9h-18h) à 20h : elle est écartée malgré sa priorité.
    // Entre promoProduit (priorité 1) et promoHappyHour (priorité 5), la plus
    // prioritaire applicable gagne.
    expect(r.promotionId).toBe('promoHappyHour')
    expect(r.prixFinal).toBe(35000)
  })

  it('une fenêtre horaire de largeur nulle ne s\'applique jamais', () => {
    const p = base({ heureDebut: 10, heureFin: 10 })
    // 10h00 à Antananarivo (vendredi) = 07h00 UTC (vendredi).
    const vendredi10h = new Date('2026-08-14T07:00:00Z')
    expect(resolvePrice(args([p], vendredi10h)).prixFinal).toBe(50000)
  })
})
