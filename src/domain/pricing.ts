import { applyPercentage } from './money'
import type { PromotionRule, EffectivePrice } from './types'

const TIMEZONE = 'Indian/Antananarivo'

/**
 * Décompose une date dans le fuseau de la boutique.
 * Intl est utilisé plutôt qu'un décalage codé en dur pour rester
 * correct si la politique horaire du pays change un jour.
 *
 * On ne lit que des composantes numériques (jamais d'abréviation de jour
 * localisée type "Mon" / "lun.") : un `indexOf` sur une chaîne qui ne
 * correspond pas à la locale attendue (données ICU réduites, changement
 * de version de Node, edge runtime) renvoie -1, et `masque >> -1` se
 * comporte comme `masque >> 31`, soit 0 — ce qui désactive silencieusement
 * toutes les promotions horaires. Le jour de la semaine est donc déduit
 * d'une date UTC reconstruite à partir de l'année/mois/jour locaux, via
 * `getUTCDay()`, converti de la convention JS (0 = dimanche) vers celle
 * du projet (0 = lundi). `hourCycle: 'h23'` garantit que minuit vaut 0
 * et non 24.
 */
function localTime(d: Date): { hour: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const component = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)

  const year = component('year')
  const month = component('month')
  const dayOfMonth = component('day')
  const hour = component('hour')

  const jsDay = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay() // 0 = dimanche
  const day = (jsDay + 6) % 7 // 0 = lundi … 6 = dimanche

  return { hour, day }
}

function isApplicable(
  p: PromotionRule, productId: string, categoryId: string,
  now: Date, isMember: boolean,
): boolean {
  if (!p.actif) return false
  if (p.membresSeulement && !isMember) return false

  if (p.portee === 'produit' && p.cibleId !== productId) return false
  if (p.portee === 'categorie' && p.cibleId !== categoryId) return false

  if (p.debut && now < p.debut) return false
  if (p.fin && now > p.fin) return false

  const { hour, day } = localTime(now)
  if (((p.joursSemaine >> day) & 1) === 0) return false

  // Une plage horaire à moitié renseignée (un seul des deux bornes migré/
  // saisi) n'est pas une restriction qu'on peut interpréter : entre laisser
  // la promotion s'appliquer 24 h/24 par erreur et ne pas l'appliquer du
  // tout, la seconde option est la seule sans risque financier.
  if ((p.heureDebut === null) !== (p.heureFin === null)) return false

  if (p.heureDebut !== null && p.heureFin !== null) {
    // Une plage qui franchit minuit (22h → 2h) est traitée comme deux intervalles.
    const inRange = p.heureDebut <= p.heureFin
      ? hour >= p.heureDebut && hour < p.heureFin
      : hour >= p.heureDebut || hour < p.heureFin
    if (!inRange) return false
  }

  return true
}

function priceAfter(p: PromotionRule, basePrice: number): number {
  return p.type === 'percent'
    ? applyPercentage(basePrice, p.valeur)
    : Math.max(0, basePrice - p.valeur)
}

export function resolvePrice(args: {
  prixBase: number
  productId: string
  categoryId: string
  promotions: PromotionRule[]
  maintenant: Date
  estMembre: boolean
}): EffectivePrice {
  const {
    prixBase: basePrice, productId, categoryId, promotions,
    maintenant: now, estMembre: isMember,
  } = args

  const candidates = promotions
    .filter((p) => isApplicable(p, productId, categoryId, now, isMember))
    .map((p) => ({ promo: p, price: priceAfter(p, basePrice) }))

  if (candidates.length === 0) {
    return { prixInitial: basePrice, prixFinal: basePrice, promotionId: null }
  }

  // Priorité décroissante, puis prix le plus bas pour la cliente.
  candidates.sort((a, b) =>
    b.promo.priorite - a.promo.priorite || a.price - b.price,
  )

  const winner = candidates[0]!
  return { prixInitial: basePrice, prixFinal: winner.price, promotionId: winner.promo.id }
}
