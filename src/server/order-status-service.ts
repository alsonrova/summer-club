import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { transitionAllowed, stockEffect, type OrderStatus } from '@/domain/order-status'
import { OrderError, OutOfStockError } from '@/server/orders'

/**
 * Transition refusée par la machine à états (src/domain/order-status.ts).
 *
 * Dérive de OrderError, comme toute la famille d'erreurs métier levée par
 * src/server/orders.ts : l'interface d'administration peut ainsi distinguer d'un coup
 * une faute rattrapable (à afficher en français) d'une panne technique (à laisser
 * remonter). `stockEffect` renvoie déjà 'none' pour une transition interdite, donc le
 * stock ne bougerait pas — mais accepter silencieusement de faire passer une commande
 * livrée à « expédiée » réécrirait l'historique sans le dire. On refuse explicitement.
 */
export class ForbiddenTransitionError extends OrderError {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Transition interdite : ${from} → ${to}`)
  }
}

/**
 * Chemins dont le rendu dépend du statut ou du stock d'une commande.
 *
 * `applyStatus` n'invalide RIEN elle-même : `revalidatePath` exige un contexte de
 * requête Next.js (« Invariant: static generation store missing » sinon — vérifié sous
 * Vitest), or ce module doit rester appelable hors requête (tests, scripts, tâches
 * planifiées). L'invalidation appartient donc aux appelants qui, eux, s'exécutent bien
 * dans une requête : la Server Action d'administration et, tâche 19, le Route Handler du
 * webhook de paiement. Cette liste est exportée pour qu'aucun des deux n'ait à deviner —
 * ni à oublier — ce qu'il faut invalider.
 */
export function pathsToRevalidate(orderId: string): string[] {
  return [
    '/admin/commandes',
    `/admin/commandes/${orderId}`,
    // Le stock affiché en boutique change avec le statut (confirmation, annulation).
    '/boutique',
  ]
}

/**
 * Cœur métier du changement de statut : lit l'état réel, décide, écrit — le tout dans une
 * seule transaction. SANS authentification, délibérément : cette fonction est appelée à la
 * fois par l'action administrateur (src/app/admin/commandes/actions.ts, qui appelle
 * requireAdmin() puis délègue ici) et, tâche 19, par le webhook de paiement, qui n'est pas
 * un administrateur. Y mettre requireAdmin() interdirait le second appelant.
 *
 * Trois points sensibles, établis par les revues précédentes :
 *
 * 1. Niveau d'isolation PAR DÉFAUT (Read Committed) avec SELECT … FOR UPDATE, jamais
 *    Serializable. Sous Serializable, une transaction bloquée sur FOR UPDATE n'obtient
 *    jamais le verrou : PostgreSQL l'avorte en 40001. Mesuré sur ce projet (stock de 5,
 *    deux clientes simultanées) : une vente sur deux était rejetée à tort.
 *
 * 2. `stockEffect` est pure et sans mémoire : appelée deux fois avec le même couple
 *    d'états, elle renvoie deux fois 'decrement'. La protection contre le rejeu (webhook
 *    livré deux fois, double clic) est ICI : la ligne de commande est verrouillée puis
 *    RELUE dans la transaction, et la décision se prend sur cet état relu — jamais sur un
 *    état reçu en paramètre. Un second appel voit le statut déjà écrit et se heurte à
 *    ForbiddenTransitionError au lieu de rejouer l'effet sur le stock.
 *
 * 3. Une confirmation peut manquer de stock. Une commande WhatsApp
 *    (pending_confirmation) ne réserve rien à la création : le stock a pu partir
 *    entre-temps. On verrouille les lignes de variantes, on les relit, et on lève
 *    OutOfStockError si le compte n'y est pas. La contrainte CHECK
 *    `variant_stock_non_negatif` (prisma/migrations/20260812204141_stock_non_negatif) est
 *    un filet de sécurité, pas la première ligne de défense : la laisser rattraper le cas
 *    donnerait une erreur SQL brute à la propriétaire.
 */
export async function applyStatus(orderId: string, to: OrderStatus, actor: string) {
  return prisma.$transaction(
    async (tx) => {
      // Verrou sur la LIGNE DE COMMANDE avant toute lecture : sans lui, deux changements
      // de statut concurrents sur la même commande liraient tous deux « confirmed » et
      // recréditeraient tous deux le stock. Le second appelant reste bloqué ici jusqu'à la
      // validation du premier, puis relit (Read Committed prend un nouvel instantané à
      // chaque instruction) le statut réellement écrit.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      })
      const from = order.status as OrderStatus

      if (!transitionAllowed(from, to)) {
        throw new ForbiddenTransitionError(from, to)
      }

      const effect = stockEffect(from, to)

      if (effect !== 'none') {
        // Agrégation par déclinaison, même raison que dans createOrder : deux lignes de
        // commande portant la même déclinaison forment une seule demande de stock. Les
        // contrôler séparément laisserait passer deux décréments là où le stock n'en
        // couvrait qu'un.
        const quantities = new Map<string, number>()
        for (const item of order.items) {
          quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity)
        }

        // Verrouillage de toutes les variantes en une instruction, dans un ordre stable
        // (par identifiant) : c'est le même ordre que celui de createOrder, ce qui
        // interdit l'interblocage entre deux transactions portant sur les mêmes variantes
        // dans des ordres différents.
        const ids = [...quantities.keys()].sort()
        await tx.$queryRawUnsafe(
          `SELECT id FROM "Variant" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
          ids,
        )

        for (const [variantId, quantity] of quantities) {
          if (effect === 'decrement') {
            // Relecture APRÈS le verrou : c'est elle qui voit la version fraîche de la
            // ligne et permet une décision juste.
            const variant = await tx.variant.findUniqueOrThrow({ where: { id: variantId } })
            if (variant.stock < quantity) throw new OutOfStockError(variantId)
            await tx.variant.update({
              where: { id: variantId },
              data: { stock: { decrement: quantity } },
            })
          } else {
            await tx.variant.update({
              where: { id: variantId },
              data: { stock: { increment: quantity } },
            })
          }
        }
      }

      const updatedOrder = await tx.order.update({ where: { id: orderId }, data: { status: to } })

      // Écrit avec `tx`, pas avec le client global : la trace ne doit exister que si le
      // changement est validé. Elle sert aussi d'historique de statut à l'écran de détail
      // (src/app/admin/commandes/[id]/page.tsx) — c'est la seule source de cet historique.
      await recordAudit(
        {
          actor,
          action: 'change_status',
          entity: 'Order',
          entityId: orderId,
          before: { status: from },
          after: { status: to },
        },
        tx,
      )

      return updatedOrder
    },
    { timeout: 15000, maxWait: 5000 },
  )
}
