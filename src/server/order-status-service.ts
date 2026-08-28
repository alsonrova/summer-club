import { prisma } from '@/server/db'
import { enregistrerAudit } from '@/server/audit'
import { transitionAutorisee, effetSurStock, type Statut } from '@/domain/order-status'
import { CommandeError, RuptureStockError } from '@/server/orders'

/**
 * Transition refusée par la machine à états (src/domain/order-status.ts).
 *
 * Dérive de CommandeError, comme toute la famille d'erreurs métier levée par
 * src/server/orders.ts : l'interface d'administration peut ainsi distinguer d'un coup
 * une faute rattrapable (à afficher en français) d'une panne technique (à laisser
 * remonter). `effetSurStock` renvoie déjà 'aucun' pour une transition interdite, donc le
 * stock ne bougerait pas — mais accepter silencieusement de faire passer une commande
 * livrée à « expédiée » réécrirait l'historique sans le dire. On refuse explicitement.
 */
export class TransitionInterditeError extends CommandeError {
  constructor(
    public readonly de: Statut,
    public readonly vers: Statut,
  ) {
    super(`Transition interdite : ${de} → ${vers}`)
  }
}

/**
 * Chemins dont le rendu dépend du statut ou du stock d'une commande.
 *
 * `appliquerStatut` n'invalide RIEN elle-même : `revalidatePath` exige un contexte de
 * requête Next.js (« Invariant: static generation store missing » sinon — vérifié sous
 * Vitest), or ce module doit rester appelable hors requête (tests, scripts, tâches
 * planifiées). L'invalidation appartient donc aux appelants qui, eux, s'exécutent bien
 * dans une requête : la Server Action d'administration et, tâche 19, le Route Handler du
 * webhook de paiement. Cette liste est exportée pour qu'aucun des deux n'ait à deviner —
 * ni à oublier — ce qu'il faut invalider.
 */
export function cheminsARevalider(orderId: string): string[] {
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
 * 2. `effetSurStock` est pure et sans mémoire : appelée deux fois avec le même couple
 *    d'états, elle renvoie deux fois 'decrementer'. La protection contre le rejeu (webhook
 *    livré deux fois, double clic) est ICI : la ligne de commande est verrouillée puis
 *    RELUE dans la transaction, et la décision se prend sur cet état relu — jamais sur un
 *    état reçu en paramètre. Un second appel voit le statut déjà écrit et se heurte à
 *    TransitionInterditeError au lieu de rejouer l'effet sur le stock.
 *
 * 3. Une confirmation peut manquer de stock. Une commande WhatsApp
 *    (en_attente_confirmation) ne réserve rien à la création : le stock a pu partir
 *    entre-temps. On verrouille les lignes de variantes, on les relit, et on lève
 *    RuptureStockError si le compte n'y est pas. La contrainte CHECK
 *    `variant_stock_non_negatif` (prisma/migrations/20260812204141_stock_non_negatif) est
 *    un filet de sécurité, pas la première ligne de défense : la laisser rattraper le cas
 *    donnerait une erreur SQL brute à la propriétaire.
 */
export async function appliquerStatut(orderId: string, vers: Statut, acteur: string) {
  return prisma.$transaction(
    async (tx) => {
      // Verrou sur la LIGNE DE COMMANDE avant toute lecture : sans lui, deux changements
      // de statut concurrents sur la même commande liraient tous deux « confirmee » et
      // recréditeraient tous deux le stock. Le second appelant reste bloqué ici jusqu'à la
      // validation du premier, puis relit (Read Committed prend un nouvel instantané à
      // chaque instruction) le statut réellement écrit.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`

      const commande = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      })
      const de = commande.statut as Statut

      if (!transitionAutorisee(de, vers)) {
        throw new TransitionInterditeError(de, vers)
      }

      const effet = effetSurStock(de, vers)

      if (effet !== 'aucun') {
        // Agrégation par déclinaison, même raison que dans creerCommande : deux lignes de
        // commande portant la même déclinaison forment une seule demande de stock. Les
        // contrôler séparément laisserait passer deux décréments là où le stock n'en
        // couvrait qu'un.
        const quantites = new Map<string, number>()
        for (const item of commande.items) {
          quantites.set(item.variantId, (quantites.get(item.variantId) ?? 0) + item.quantite)
        }

        // Verrouillage de toutes les variantes en une instruction, dans un ordre stable
        // (par identifiant) : c'est le même ordre que celui de creerCommande, ce qui
        // interdit l'interblocage entre deux transactions portant sur les mêmes variantes
        // dans des ordres différents.
        const ids = [...quantites.keys()].sort()
        await tx.$queryRawUnsafe(
          `SELECT id FROM "Variant" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
          ids,
        )

        for (const [variantId, quantite] of quantites) {
          if (effet === 'decrementer') {
            // Relecture APRÈS le verrou : c'est elle qui voit la version fraîche de la
            // ligne et permet une décision juste.
            const variante = await tx.variant.findUniqueOrThrow({ where: { id: variantId } })
            if (variante.stock < quantite) throw new RuptureStockError(variantId)
            await tx.variant.update({
              where: { id: variantId },
              data: { stock: { decrement: quantite } },
            })
          } else {
            await tx.variant.update({
              where: { id: variantId },
              data: { stock: { increment: quantite } },
            })
          }
        }
      }

      const apres = await tx.order.update({ where: { id: orderId }, data: { statut: vers } })

      // Écrit avec `tx`, pas avec le client global : la trace ne doit exister que si le
      // changement est validé. Elle sert aussi d'historique de statut à l'écran de détail
      // (src/app/admin/commandes/[id]/page.tsx) — c'est la seule source de cet historique.
      await enregistrerAudit(
        {
          acteur,
          action: 'changement_statut',
          entite: 'Order',
          entiteId: orderId,
          avant: { statut: de },
          apres: { statut: vers },
        },
        tx,
      )

      return apres
    },
    { timeout: 15000, maxWait: 5000 },
  )
}
