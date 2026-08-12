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

/** États dans lesquels le stock est déjà retiré de l'inventaire. */
const STOCK_ENGAGE: Statut[] = [
  'confirmee', 'en_preparation', 'expediee', 'prete_retrait', 'livree',
]

export function transitionAutorisee(de: Statut, vers: Statut): boolean {
  return TRANSITIONS[de].includes(vers)
}

export function effetSurStock(
  de: Statut, vers: Statut,
): 'decrementer' | 'recrediter' | 'aucun' {
  const avant = STOCK_ENGAGE.includes(de)
  const apres = STOCK_ENGAGE.includes(vers)
  if (!avant && apres) return 'decrementer'
  if (avant && !apres) return 'recrediter'
  return 'aucun'
}
