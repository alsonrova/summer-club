import { appliquerPourcentage } from './money'
import type { PromotionRule, PrixEffectif } from './types'

const FUSEAU = 'Indian/Antananarivo'

/**
 * Décompose une date dans le fuseau de la boutique.
 * Intl est utilisé plutôt qu'un décalage codé en dur pour rester
 * correct si la politique horaire du pays change un jour.
 */
function heureLocale(d: Date): { heure: number; jour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSEAU, hour: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(d)
  const heure = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const noms = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const jour = noms.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? 'Mon')
  return { heure, jour }
}

function estApplicable(
  p: PromotionRule, productId: string, categoryId: string,
  maintenant: Date, estMembre: boolean,
): boolean {
  if (!p.actif) return false
  if (p.membresSeulement && !estMembre) return false

  if (p.portee === 'produit' && p.cibleId !== productId) return false
  if (p.portee === 'categorie' && p.cibleId !== categoryId) return false

  if (p.debut && maintenant < p.debut) return false
  if (p.fin && maintenant > p.fin) return false

  const { heure, jour } = heureLocale(maintenant)
  if (((p.joursSemaine >> jour) & 1) === 0) return false

  if (p.heureDebut !== null && p.heureFin !== null) {
    // Une plage qui franchit minuit (22h → 2h) est traitée comme deux intervalles.
    const dansLaPlage = p.heureDebut <= p.heureFin
      ? heure >= p.heureDebut && heure < p.heureFin
      : heure >= p.heureDebut || heure < p.heureFin
    if (!dansLaPlage) return false
  }

  return true
}

function prixApres(p: PromotionRule, prixBase: number): number {
  return p.type === 'percent'
    ? appliquerPourcentage(prixBase, p.valeur)
    : Math.max(0, prixBase - p.valeur)
}

export function resolvePrix(args: {
  prixBase: number
  productId: string
  categoryId: string
  promotions: PromotionRule[]
  maintenant: Date
  estMembre: boolean
}): PrixEffectif {
  const { prixBase, productId, categoryId, promotions, maintenant, estMembre } = args

  const candidates = promotions
    .filter((p) => estApplicable(p, productId, categoryId, maintenant, estMembre))
    .map((p) => ({ promo: p, prix: prixApres(p, prixBase) }))

  if (candidates.length === 0) {
    return { prixInitial: prixBase, prixFinal: prixBase, promotionId: null }
  }

  // Priorité décroissante, puis prix le plus bas pour la cliente.
  candidates.sort((a, b) =>
    b.promo.priorite - a.promo.priorite || a.prix - b.prix,
  )

  const gagnante = candidates[0]!
  return { prixInitial: prixBase, prixFinal: gagnante.prix, promotionId: gagnante.promo.id }
}
