import { describe, it, expect } from 'vitest'
import { resolvePrice } from '@/domain/pricing'
import type { PromotionRule } from '@/domain/types'

const base = (o: Partial<PromotionRule> = {}): PromotionRule => ({
  id: 'p1', type: 'percent', value: 20, scope: 'all', targetId: null,
  startsAt: null, endsAt: null, weekdays: 127, startHour: null, endHour: null,
  membersOnly: false, priority: 0, active: true, ...o,
})

// 2026-08-14 est un vendredi. 20h00 à Antananarivo = 17h00 UTC.
const FRIDAY_8PM = new Date('2026-08-14T17:00:00Z')
const FRIDAY_11PM = new Date('2026-08-14T20:00:00Z')
const args = (p: PromotionRule[], now = FRIDAY_8PM, isMember = false) => ({
  basePrice: 50000, productId: 'prod1', categoryId: 'cat1',
  promotions: p, now, isMember,
})

describe('resolvePrice', () => {
  it('sans promotion, le prix de base est retourné', () => {
    expect(resolvePrice(args([]))).toEqual({
      initialPrice: 50000, finalPrice: 50000, promotionId: null,
    })
  })

  it('applique une remise en pourcentage', () => {
    expect(resolvePrice(args([base()])).finalPrice).toBe(40000)
  })

  it('applique une remise en montant fixe', () => {
    expect(resolvePrice(args([base({ type: 'fixed', value: 5000 })])).finalPrice).toBe(45000)
  })

  it('ignore une promotion inactive', () => {
    expect(resolvePrice(args([base({ active: false })])).finalPrice).toBe(50000)
  })

  it('ignore une promotion dont la fenêtre de dates est passée', () => {
    const p = base({ startsAt: new Date('2026-01-01'), endsAt: new Date('2026-02-01') })
    expect(resolvePrice(args([p])).finalPrice).toBe(50000)
  })

  it('applique une promotion dont la fenêtre de dates est courante', () => {
    const p = base({ startsAt: new Date('2026-08-01'), endsAt: new Date('2026-09-01') })
    expect(resolvePrice(args([p])).finalPrice).toBe(40000)
  })

  it('applique un happy hour pendant sa plage horaire', () => {
    const p = base({ startHour: 20, endHour: 22 })
    expect(resolvePrice(args([p], FRIDAY_8PM)).finalPrice).toBe(40000)
  })

  it('ignore un happy hour en dehors de sa plage horaire', () => {
    const p = base({ startHour: 20, endHour: 22 })
    expect(resolvePrice(args([p], FRIDAY_11PM)).finalPrice).toBe(50000)
  })

  it('ignore un happy hour un jour non couvert par le masque', () => {
    // masque lundi seulement = bit 0
    const p = base({ startHour: 20, endHour: 22, weekdays: 0b0000001 })
    expect(resolvePrice(args([p], FRIDAY_8PM)).finalPrice).toBe(50000)
  })

  it('ignore une promotion membre pour un visiteur non connecté', () => {
    expect(resolvePrice(args([base({ membersOnly: true })])).finalPrice).toBe(50000)
  })

  it('applique une promotion membre pour un membre', () => {
    expect(resolvePrice(args([base({ membersOnly: true })], FRIDAY_8PM, true)).finalPrice).toBe(40000)
  })

  it('ignore une promotion ciblant un autre produit', () => {
    const p = base({ scope: 'product', targetId: 'autre' })
    expect(resolvePrice(args([p])).finalPrice).toBe(50000)
  })

  it('applique une promotion ciblant la bonne catégorie', () => {
    const p = base({ scope: 'category', targetId: 'cat1' })
    expect(resolvePrice(args([p])).finalPrice).toBe(40000)
  })

  it('ne cumule jamais deux promotions : la plus prioritaire gagne', () => {
    const faible = base({ id: 'faible', value: 10, priority: 1 })
    const forte = base({ id: 'forte', value: 30, priority: 5 })
    const r = resolvePrice(args([faible, forte]))
    expect(r.finalPrice).toBe(35000)
    expect(r.promotionId).toBe('forte')
  })

  it('à priorité égale, la remise la plus avantageuse pour la cliente gagne', () => {
    const a = base({ id: 'a', value: 10 })
    const b = base({ id: 'b', value: 25 })
    expect(resolvePrice(args([a, b])).promotionId).toBe('b')
  })

  it('ne descend jamais sous zéro', () => {
    expect(resolvePrice(args([base({ type: 'fixed', value: 999999 })])).finalPrice).toBe(0)
  })
})

describe('resolvePrice — robustesse fuseau et fenêtres horaires', () => {
  // 2026-08-14 est un vendredi, 2026-08-15 un samedi.
  // Antananarivo = UTC+3 toute l'année (pas d'heure d'été/hiver).

  it('applique un happy hour qui franchit minuit, à l\'intérieur de la plage', () => {
    const p = base({ startHour: 22, endHour: 2 })
    // 23h00 à Antananarivo (vendredi) = 20h00 UTC (vendredi).
    const vendredi23h = new Date('2026-08-14T20:00:00Z')
    expect(resolvePrice(args([p], vendredi23h)).finalPrice).toBe(40000)

    // 0h30 à Antananarivo (samedi) = 21h30 UTC (vendredi).
    const samedi0h30 = new Date('2026-08-14T21:30:00Z')
    expect(resolvePrice(args([p], samedi0h30)).finalPrice).toBe(40000)
  })

  it('ignore un happy hour qui franchit minuit, en dehors de la plage', () => {
    const p = base({ startHour: 22, endHour: 2 })
    // 21h00 à Antananarivo (vendredi) = 18h00 UTC (vendredi).
    const vendredi21h = new Date('2026-08-14T18:00:00Z')
    expect(resolvePrice(args([p], vendredi21h)).finalPrice).toBe(50000)

    // 2h00 à Antananarivo (samedi) = 23h00 UTC (vendredi).
    const samedi2h = new Date('2026-08-14T23:00:00Z')
    expect(resolvePrice(args([p], samedi2h)).finalPrice).toBe(50000)
  })

  it('applique une promotion pile à minuit heure locale (heure = 0, pas 24)', () => {
    const p = base({ startHour: 0, endHour: 6 })
    // 0h00 à Antananarivo (samedi) = 21h00 UTC (vendredi).
    const samediMinuit = new Date('2026-08-14T21:00:00Z')
    expect(resolvePrice(args([p], samediMinuit)).finalPrice).toBe(40000)
  })

  it('ne s\'applique jamais si seule une borne de la plage horaire est renseignée', () => {
    const debutSeul = base({ startHour: 20, endHour: null })
    const finSeule = base({ startHour: null, endHour: 22 })
    // 20h00 à Antananarivo (vendredi) = 17h00 UTC (vendredi).
    const vendredi20h = new Date('2026-08-14T17:00:00Z')
    expect(resolvePrice(args([debutSeul], vendredi20h)).finalPrice).toBe(50000)
    expect(resolvePrice(args([finSeule], vendredi20h)).finalPrice).toBe(50000)
  })

  it('la plage horaire normale est inclusive au début et exclusive à la fin', () => {
    const p = base({ startHour: 20, endHour: 22 })
    // 20h00 à Antananarivo (vendredi) = 17h00 UTC (vendredi) : borne de début, appliquée.
    const vendredi20h = new Date('2026-08-14T17:00:00Z')
    expect(resolvePrice(args([p], vendredi20h)).finalPrice).toBe(40000)

    // 22h00 à Antananarivo (vendredi) = 19h00 UTC (vendredi) : borne de fin, non appliquée.
    const vendredi22h = new Date('2026-08-14T19:00:00Z')
    expect(resolvePrice(args([p], vendredi22h)).finalPrice).toBe(50000)
  })

  it('scénario combiné : une seule des trois promotions simultanées s\'applique', () => {
    const productPromo = base({
      id: 'promoProduit', scope: 'product', targetId: 'prod1', priority: 1, value: 10,
    })
    const categoryPromoOutOfHours = base({
      id: 'promoCategorieHorsHeure', scope: 'category', targetId: 'cat1',
      startHour: 9, endHour: 18, priority: 10, value: 80,
    })
    const promoHappyHour = base({
      id: 'promoHappyHour', scope: 'all', startHour: 19, endHour: 21, priority: 5, value: 30,
    })
    // 20h00 à Antananarivo (vendredi) = 17h00 UTC (vendredi).
    const vendredi20h = new Date('2026-08-14T17:00:00Z')
    const r = resolvePrice(
      args([productPromo, categoryPromoOutOfHours, promoHappyHour], vendredi20h),
    )
    // promoCategorieHorsHeure a la priorité la plus haute mais n'est pas dans sa
    // plage horaire (9h-18h) à 20h : elle est écartée malgré sa priorité.
    // Entre promoProduit (priorité 1) et promoHappyHour (priorité 5), la plus
    // prioritaire applicable gagne.
    expect(r.promotionId).toBe('promoHappyHour')
    expect(r.finalPrice).toBe(35000)
  })

  it('une fenêtre horaire de largeur nulle ne s\'applique jamais', () => {
    const p = base({ startHour: 10, endHour: 10 })
    // 10h00 à Antananarivo (vendredi) = 07h00 UTC (vendredi).
    const vendredi10h = new Date('2026-08-14T07:00:00Z')
    expect(resolvePrice(args([p], vendredi10h)).finalPrice).toBe(50000)
  })
})
