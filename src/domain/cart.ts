export type CartLine = { variantId: string; unitPrice: number; quantity: number }
export type CartTotals = {
  subtotal: number; shippingFee: number; discount: number; total: number
}

export function computeTotals(
  lines: CartLine[],
  zoneFee: number | null,
): CartTotals {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  // Un panier vide ne facture jamais de livraison.
  const shippingFee = subtotal === 0 ? 0 : (zoneFee ?? 0)
  const discount = 0
  return { subtotal, shippingFee, discount, total: subtotal + shippingFee - discount }
}
