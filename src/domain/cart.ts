export type CartLine = { variantId: string; prixUnitaire: number; quantite: number }
export type CartTotals = {
  sousTotal: number; fraisLivraison: number; remise: number; total: number
}

export function computeTotals(
  lines: CartLine[],
  zoneFee: number | null,
): CartTotals {
  const subtotal = lines.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0)
  // Un panier vide ne facture jamais de livraison.
  const shippingFee = subtotal === 0 ? 0 : (zoneFee ?? 0)
  const discount = 0
  return {
    sousTotal: subtotal, fraisLivraison: shippingFee, remise: discount,
    total: subtotal + shippingFee - discount,
  }
}
