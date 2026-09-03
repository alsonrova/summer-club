/**
 * Les neuf statuts, dans l'ordre du cycle de vie d'une commande. Déclarés comme un tuple
 * `as const` — et non comme une union de types seule — pour qu'ils existent aussi À
 * L'EXÉCUTION : l'administration a besoin de la liste réelle pour peupler un filtre et
 * pour rejeter une valeur forgée avant qu'elle n'atteigne l'énumération PostgreSQL. Le
 * type `OrderStatus` en est dérivé, ce qui interdit à la liste et à l'union de diverger.
 */
export const ORDER_STATUSES = [
  'pending_confirmation', 'pending_payment', 'confirmed',
  'preparing', 'shipped', 'ready_for_pickup', 'delivered',
  'cancelled', 'payment_failed',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Vrai si la chaîne est l'un des neuf statuts — pour valider une valeur venue du client. */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  pending_payment: ['confirmed', 'payment_failed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'ready_for_pickup', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  ready_for_pickup: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  payment_failed: ['pending_payment', 'cancelled'],
}

/**
 * États dans lesquels le stock est déjà retiré de l'inventaire.
 *
 * `pending_payment` y figure : le canal orange_money réserve le stock
 * dès la création de la commande (avant même la confirmation du paiement),
 * pour empêcher deux clientes de payer la même dernière pièce. Comme cet
 * état est déjà dans l'ensemble, la transition pending_payment →
 * confirmed n'y ajoute rien : pas de second décrément sur un stock déjà
 * réservé. `pending_confirmation` (canal whatsapp) n'y figure pas : ces
 * commandes attendent un accord manuel qui peut ne jamais venir, donc rien
 * n'est réservé avant la confirmation effective.
 */
export const STOCK_COMMITTED: readonly OrderStatus[] = [
  'confirmed', 'preparing', 'shipped', 'ready_for_pickup', 'delivered',
  'pending_payment',
]

/**
 * Statuts atteignables depuis `from`, dans l'ordre de déclaration de TRANSITIONS.
 *
 * Existe pour que l'interface d'administration n'offre QUE des transitions réellement
 * autorisées : un bouton qui mène à une erreur est un défaut d'interface. Renvoie une
 * copie, pour qu'un appelant ne puisse pas modifier la table de transitions à distance.
 */
export function transitionsFrom(from: OrderStatus): OrderStatus[] {
  return [...TRANSITIONS[from]]
}

export function transitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/**
 * Effet à appliquer sur le stock pour une transition de statut.
 *
 * Sûre par construction : si `transitionAllowed(from, to)` est faux,
 * le résultat est toujours 'none', même si le couple (from, to) changerait
 * l'appartenance à STOCK_COMMITTED. Entre décrémenter/recréditer à tort et ne
 * rien faire, ne rien faire est le seul des deux qui ne fausse pas
 * l'inventaire.
 *
 * Fonction pure et sans mémoire : appelée deux fois avec le même couple
 * (from, to), elle renvoie deux fois le même effet. Elle ne protège donc pas
 * contre le rejeu d'un même événement (webhook livré deux fois, double clic
 * en back-office) — cette protection appartient à l'appelant, qui doit
 * relire l'état réel en base et effectuer lecture, décision et écriture
 * dans une même transaction.
 */
export function stockEffect(
  from: OrderStatus, to: OrderStatus,
): 'decrement' | 'credit_back' | 'none' {
  if (!transitionAllowed(from, to)) return 'none'
  const before = STOCK_COMMITTED.includes(from)
  const after = STOCK_COMMITTED.includes(to)
  if (!before && after) return 'decrement'
  if (before && !after) return 'credit_back'
  return 'none'
}
