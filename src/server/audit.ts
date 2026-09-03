import type { Prisma } from '@prisma/client'
import { prisma } from './db'

/**
 * Client accepté par `recordAudit` : le client Prisma global par défaut, ou le
 * client de transaction (`tx`) reçu dans un `prisma.$transaction(async (tx) => …)`.
 *
 * `Prisma.TransactionClient` est `Omit<PrismaClient, ITXClientDenyList>` : le client
 * global lui est structurellement assignable, ce qui permet aux deux d'être passés ici
 * sans cast.
 */
export type AuditClient = Prisma.TransactionClient

export async function recordAudit(
  args: {
    actor: string
    action: string
    entity: string
    entityId: string
    before?: unknown
    after?: unknown
  },
  // Par défaut le client global : tous les appelants existants (créations, modifications,
  // suppressions de ressources) écrivent leur trace hors transaction, comme avant.
  // `applyStatus` (src/server/order-status-service.ts) passe en revanche SON client de
  // transaction : la trace d'un changement de statut ne doit exister que si le changement
  // lui-même a été validé. Écrite avec le client global depuis l'intérieur d'une
  // transaction, elle partirait sur une autre connexion et survivrait à un ROLLBACK —
  // le journal affirmerait alors un changement que la base n'a jamais enregistré.
  client: AuditClient = prisma,
) {
  await client.auditLog.create({
    data: {
      acteur: args.actor,
      action: args.action,
      entite: args.entity,
      entiteId: args.entityId,
      // `avant`/`apres` sont des colonnes Prisma `Json?` : le type d'entrée généré
      // (`Prisma.InputJsonValue | typeof DbNull | null`, voir
      // node_modules/.prisma/client/index.d.ts) n'accepte pas `unknown`, seulement des
      // valeurs déjà connues comme sérialisables en JSON. Ici la valeur vient soit de
      // `null`, soit de `resultat.donnees`/`avant` (déjà passés par `safeParse` ou lus
      // depuis Prisma), donc toujours sérialisable — le cast est sûr, mais le type de
      // Prisma ne peut pas le vérifier statiquement pour un `unknown` générique.
      avant: (args.before ?? null) as never,
      apres: (args.after ?? null) as never,
    },
  })
}
