import { appliquerPourcentage } from './money'
import type { PromotionRule, PrixEffectif } from './types'

const FUSEAU = 'Indian/Antananarivo'

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
function heureLocale(d: Date): { heure: number; jour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSEAU,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const composante = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)

  const annee = composante('year')
  const mois = composante('month')
  const jourDuMois = composante('day')
  const heure = composante('hour')

  const jourJS = new Date(Date.UTC(annee, mois - 1, jourDuMois)).getUTCDay() // 0 = dimanche
  const jour = (jourJS + 6) % 7 // 0 = lundi … 6 = dimanche

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

  // Une plage horaire à moitié renseignée (un seul des deux bornes migré/
  // saisi) n'est pas une restriction qu'on peut interpréter : entre laisser
  // la promotion s'appliquer 24 h/24 par erreur et ne pas l'appliquer du
  // tout, la seconde option est la seule sans risque financier.
  if ((p.heureDebut === null) !== (p.heureFin === null)) return false

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
