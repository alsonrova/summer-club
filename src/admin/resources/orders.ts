import { z } from 'zod'
import type { Canal } from '@prisma/client'
import { defineResource } from '@/admin/resource'
import { ORDER_STATUSES } from '@/domain/order-status'

// Aligné sur l'énumération Prisma `Canal` (prisma/schema.prisma) par `satisfies` : ajouter
// un canal au schéma sans l'ajouter ici devient une erreur de compilation, plutôt qu'un
// filtre silencieusement incomplet.
export const CHANNELS = ['orange_money', 'whatsapp', 'livraison'] as const satisfies readonly Canal[]

/**
 * Vrai si la valeur est l'un des trois canaux — pour valider une valeur venue du client
 * (aujourd'hui la querystring du filtre de liste).
 *
 * Écrit comme `isOrderStatus` (src/domain/order-status.ts) et `estStatutAvis`
 * (src/app/admin/avis/query.ts) : un GARDE DE TYPE, pas un `includes` suivi d'un `as`. La
 * différence n'est pas cosmétique — avec l'assertion, le compilateur ne vérifie plus rien et
 * une divergence entre le test et le type affirmé passe inaperçue. Ce projet n'a désormais
 * qu'une seule façon de valider une valeur d'énumération.
 */
export function isChannel(value: unknown): value is Canal {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value)
}

export const STATUS_LABELS = {
  en_attente_confirmation: 'En attente de confirmation',
  en_attente_paiement: 'En attente de paiement',
  confirmee: 'Confirmée',
  en_preparation: 'En préparation',
  expediee: 'Expédiée',
  prete_retrait: 'Prête pour retrait',
  livree: 'Livrée',
  annulee: 'Annulée',
  echec_paiement: 'Paiement échoué',
} as const satisfies Record<(typeof ORDER_STATUSES)[number], string>

// Libellés des BOUTONS de transition, à l'infinitif : un bouton nomme l'action qu'il
// déclenche, pas l'état qu'il vise. « Confirmer la commande » se lit ; un bouton intitulé
// « Confirmée » laisse la propriétaire se demander s'il décrit l'état courant ou la suite.
export const TRANSITION_LABELS = {
  en_attente_confirmation: 'Remettre en attente de confirmation',
  en_attente_paiement: 'Remettre en attente de paiement',
  confirmee: 'Confirmer la commande',
  en_preparation: 'Mettre en préparation',
  expediee: 'Marquer expédiée',
  prete_retrait: 'Marquer prête pour retrait',
  livree: 'Marquer livrée',
  annulee: 'Annuler la commande',
  echec_paiement: 'Marquer le paiement en échec',
} as const satisfies Record<(typeof ORDER_STATUSES)[number], string>

export const CHANNEL_LABELS = {
  orange_money: 'Orange Money',
  whatsapp: 'WhatsApp',
  livraison: 'Livraison',
} as const satisfies Record<Canal, string>

// Prennent une chaîne, pas un `OrderStatus` : l'historique de statut est relu depuis les
// colonnes Json du journal d'audit, où le type n'est pas garanti. Un statut inconnu
// s'affiche tel quel plutôt que « undefined ».
export function statusLabel(value: string): string {
  return (STATUS_LABELS as Record<string, string>)[value] ?? value
}

export function channelLabel(value: string): string {
  return (CHANNEL_LABELS as Record<string, string>)[value] ?? value
}

// Ce schéma ne sert PAS à valider une saisie : une commande n'est jamais créée ni modifiée
// depuis l'administration (elle naît du tunnel d'achat, et seul son statut évolue, par
// `changerStatut`). Il ne sert qu'à décrire les colonnes de la liste — leur type
// d'affichage (nombre en tabular-nums, date formatée) et leur libellé français — pour
// <AdminTable>.
export const orderSchema = z.object({
  reference: z.string(),
  createdAt: z.date(),
  clientNom: z.string(),
  tel: z.string(),
  canal: z.enum(CHANNELS),
  statut: z.enum(ORDER_STATUSES),
  total: z.number().int(),
})

export type OrderListInput = z.infer<typeof orderSchema>

export const ordersResource = defineResource<OrderListInput>({
  name: 'commandes',
  label: 'Commandes',
  schema: orderSchema,
  columns: ['reference', 'createdAt', 'clientNom', 'canal', 'statut', 'total'],
  filters: ['statut', 'canal', 'reference'],
  actions: [],
  // `createdAt` est ici une COLONNE AFFICHÉE, pas un champ de formulaire : la laisser dans
  // DEFAULT_SYSTEM_FIELDS la retirerait de `fields`, et <AdminTable> perdrait à la
  // fois son libellé et son type `date` — la date s'afficherait alors sous sa forme brute.
  // Aucun risque de forge par là : cette ressource n'a pas de formulaire (voir ci-dessus),
  // et `id` n'est délibérément pas dans le schéma.
  systemFields: [],
  labels: {
    reference: 'Référence',
    createdAt: 'Date',
    clientNom: 'Cliente',
    tel: 'Téléphone',
    canal: 'Canal',
    statut: 'Statut',
    total: 'Total',
  },
})
