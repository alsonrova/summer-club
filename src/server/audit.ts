import { prisma } from './db'

export async function enregistrerAudit(args: {
  acteur: string
  action: string
  entite: string
  entiteId: string
  avant?: unknown
  apres?: unknown
}) {
  await prisma.auditLog.create({
    data: {
      acteur: args.acteur,
      action: args.action,
      entite: args.entite,
      entiteId: args.entiteId,
      avant: (args.avant ?? null) as never,
      apres: (args.apres ?? null) as never,
    },
  })
}
