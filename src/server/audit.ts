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
      // `avant`/`apres` sont des colonnes Prisma `Json?` : le type d'entrée généré
      // (`Prisma.InputJsonValue | typeof DbNull | null`, voir
      // node_modules/.prisma/client/index.d.ts) n'accepte pas `unknown`, seulement des
      // valeurs déjà connues comme sérialisables en JSON. Ici la valeur vient soit de
      // `null`, soit de `resultat.donnees`/`avant` (déjà passés par `safeParse` ou lus
      // depuis Prisma), donc toujours sérialisable — le cast est sûr, mais le type de
      // Prisma ne peut pas le vérifier statiquement pour un `unknown` générique.
      avant: (args.avant ?? null) as never,
      apres: (args.apres ?? null) as never,
    },
  })
}
