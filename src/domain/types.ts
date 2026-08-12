export type PromotionRule = {
  id: string
  type: 'percent' | 'fixed'
  valeur: number
  portee: 'produit' | 'categorie' | 'tout'
  cibleId: string | null
  debut: Date | null
  fin: Date | null
  joursSemaine: number
  heureDebut: number | null
  heureFin: number | null
  membresSeulement: boolean
  priorite: number
  actif: boolean
}

export type PrixEffectif = {
  prixInitial: number
  prixFinal: number
  promotionId: string | null
}
