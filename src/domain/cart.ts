export type LignePanier = { variantId: string; prixUnitaire: number; quantite: number }
export type TotauxPanier = {
  sousTotal: number; fraisLivraison: number; remise: number; total: number
}

export function calculerTotaux(
  lignes: LignePanier[],
  tarifZone: number | null,
): TotauxPanier {
  const sousTotal = lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0)
  // Un panier vide ne facture jamais de livraison.
  const fraisLivraison = sousTotal === 0 ? 0 : (tarifZone ?? 0)
  const remise = 0
  return { sousTotal, fraisLivraison, remise, total: sousTotal + fraisLivraison - remise }
}
