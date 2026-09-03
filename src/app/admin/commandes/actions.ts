'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth'
import { OutOfStockError } from '@/server/orders'
import {
  applyStatus,
  pathsToRevalidate,
  ForbiddenTransitionError,
} from '@/server/order-status-service'
import { isOrderStatus, type OrderStatus } from '@/domain/order-status'
import { statusLabel } from '@/admin/resources/orders'
import type { StatusChangeState } from './etats'

// Convention de sécurité (voir src/server/auth.ts) : un layout ne protège ni les Server
// Actions ni les Route Handlers. Chaque action ci-dessous appelle requireAdmin() elle-même,
// en première instruction. La lecture de session est mise en cache par requête, ce doublon
// ne coûte rien.

/**
 * Enveloppe AUTHENTIFIÉE d'`applyStatus` : vérifie l'administratrice, transmet son
 * e-mail comme acteur du journal, puis invalide les caches.
 *
 * Le cœur métier vit dans src/server/order-status-service.ts, sans authentification, parce
 * que le webhook de paiement (tâche 19) l'appellera aussi et n'est pas un administrateur.
 */
export async function changeStatus(orderId: string, to: OrderStatus) {
  const session = await requireAdmin()

  // `to` arrive du client : une Server Action exportée est une route publique, protégée
  // par requireAdmin() mais pas typée à l'exécution. La machine à états rejetterait déjà une
  // valeur inconnue (`transitionAllowed` renvoie faux), mais mieux vaut la refuser ici,
  // avant qu'elle n'atteigne l'énumération PostgreSQL, avec un message compréhensible.
  if (!isOrderStatus(to)) {
    throw new Error(`Statut inconnu : ${String(to)}`)
  }

  const order = await applyStatus(orderId, to, session.user.email)

  // `applyStatus` n'invalide rien elle-même (elle doit rester appelable hors requête,
  // cf. son commentaire) : c'est ici, dans une vraie requête, qu'on le fait — en suivant la
  // liste qu'elle publie, pour n'en oublier aucun.
  for (const path of pathsToRevalidate(orderId)) {
    revalidatePath(path)
  }

  return order
}

/**
 * Adaptateur `useActionState` du bouton de transition.
 *
 * Next.js prescrit de RETOURNER les erreurs attendues plutôt que de les lever (voir
 * node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md, « Handling
 * expected errors ») : un stock parti entre-temps et une commande déjà changée par un
 * autre onglet sont deux situations normales, que la propriétaire doit lire en français.
 * Tout le reste est relevé tel quel — y compris la redirection de requireAdmin(), qui
 * s'implémente par un throw et ne doit surtout pas être avalée ici.
 */
export async function changeStatusFromForm(
  orderId: string,
  to: OrderStatus,
  _previousState: StatusChangeState,
  _formData: FormData,
): Promise<StatusChangeState> {
  await requireAdmin()

  try {
    await changeStatus(orderId, to)
  } catch (error) {
    if (error instanceof OutOfStockError) {
      return {
        error:
          "Stock insuffisant pour confirmer cette commande : la pièce est partie entre-temps. "
          + 'Réapprovisionnez la déclinaison concernée, ou annulez la commande.',
      }
    }
    if (error instanceof ForbiddenTransitionError) {
      return {
        error:
          `Cette commande est passée à « ${statusLabel(error.from)} » entre-temps : `
          + `« ${statusLabel(error.to)} » n'est plus possible. Rechargez la page.`,
      }
    }
    throw error
  }

  return { error: null }
}
