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
import type { EtatChangementStatut } from './etats'

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
export async function changerStatut(orderId: string, vers: OrderStatus) {
  const session = await requireAdmin()

  // `vers` arrive du client : une Server Action exportée est une route publique, protégée
  // par requireAdmin() mais pas typée à l'exécution. La machine à états rejetterait déjà une
  // valeur inconnue (`transitionAllowed` renvoie faux), mais mieux vaut la refuser ici,
  // avant qu'elle n'atteigne l'énumération PostgreSQL, avec un message compréhensible.
  if (!isOrderStatus(vers)) {
    throw new Error(`Statut inconnu : ${String(vers)}`)
  }

  const commande = await applyStatus(orderId, vers, session.user.email)

  // `applyStatus` n'invalide rien elle-même (elle doit rester appelable hors requête,
  // cf. son commentaire) : c'est ici, dans une vraie requête, qu'on le fait — en suivant la
  // liste qu'elle publie, pour n'en oublier aucun.
  for (const chemin of pathsToRevalidate(orderId)) {
    revalidatePath(chemin)
  }

  return commande
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
export async function changerStatutDepuisFormulaire(
  orderId: string,
  vers: OrderStatus,
  _etatPrecedent: EtatChangementStatut,
  _formData: FormData,
): Promise<EtatChangementStatut> {
  await requireAdmin()

  try {
    await changerStatut(orderId, vers)
  } catch (erreur) {
    if (erreur instanceof OutOfStockError) {
      return {
        erreur:
          "Stock insuffisant pour confirmer cette commande : la pièce est partie entre-temps. "
          + 'Réapprovisionnez la déclinaison concernée, ou annulez la commande.',
      }
    }
    if (erreur instanceof ForbiddenTransitionError) {
      return {
        erreur:
          `Cette commande est passée à « ${statusLabel(erreur.from)} » entre-temps : `
          + `« ${statusLabel(erreur.to)} » n'est plus possible. Rechargez la page.`,
      }
    }
    throw erreur
  }

  return { erreur: null }
}
