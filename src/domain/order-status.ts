export type Statut =
  | 'en_attente_confirmation' | 'en_attente_paiement' | 'confirmee'
  | 'en_preparation' | 'expediee' | 'prete_retrait' | 'livree'
  | 'annulee' | 'echec_paiement'

const TRANSITIONS: Record<Statut, Statut[]> = {
  en_attente_confirmation: ['confirmee', 'annulee'],
  en_attente_paiement: ['confirmee', 'echec_paiement', 'annulee'],
  confirmee: ['en_preparation', 'annulee'],
  en_preparation: ['expediee', 'prete_retrait', 'annulee'],
  expediee: ['livree', 'annulee'],
  prete_retrait: ['livree', 'annulee'],
  livree: [],
  annulee: [],
  echec_paiement: ['en_attente_paiement', 'annulee'],
}

/**
 * États dans lesquels le stock est déjà retiré de l'inventaire.
 *
 * `en_attente_paiement` y figure : le canal orange_money réserve le stock
 * dès la création de la commande (avant même la confirmation du paiement),
 * pour empêcher deux clientes de payer la même dernière pièce. Comme cet
 * état est déjà dans l'ensemble, la transition en_attente_paiement →
 * confirmee n'y ajoute rien : pas de second décrément sur un stock déjà
 * réservé. En_attente_confirmation (canal whatsapp) n'y figure pas : ces
 * commandes attendent un accord manuel qui peut ne jamais venir, donc rien
 * n'est réservé avant la confirmation effective.
 */
export const STOCK_ENGAGE: readonly Statut[] = [
  'confirmee', 'en_preparation', 'expediee', 'prete_retrait', 'livree',
  'en_attente_paiement',
]

export function transitionAutorisee(de: Statut, vers: Statut): boolean {
  return TRANSITIONS[de].includes(vers)
}

/**
 * Effet à appliquer sur le stock pour une transition de statut.
 *
 * Sûre par construction : si `transitionAutorisee(de, vers)` est faux,
 * le résultat est toujours 'aucun', même si le couple (de, vers) changerait
 * l'appartenance à STOCK_ENGAGE. Entre décrémenter/recréditer à tort et ne
 * rien faire, ne rien faire est le seul des deux qui ne fausse pas
 * l'inventaire.
 *
 * Fonction pure et sans mémoire : appelée deux fois avec le même couple
 * (de, vers), elle renvoie deux fois le même effet. Elle ne protège donc pas
 * contre le rejeu d'un même événement (webhook livré deux fois, double clic
 * en back-office) — cette protection appartient à l'appelant, qui doit
 * relire l'état réel en base et effectuer lecture, décision et écriture
 * dans une même transaction.
 */
export function effetSurStock(
  de: Statut, vers: Statut,
): 'decrementer' | 'recrediter' | 'aucun' {
  if (!transitionAutorisee(de, vers)) return 'aucun'
  const avant = STOCK_ENGAGE.includes(de)
  const apres = STOCK_ENGAGE.includes(vers)
  if (!avant && apres) return 'decrementer'
  if (avant && !apres) return 'recrediter'
  return 'aucun'
}
