import { Prisma } from '@prisma/client'

// P2002 (violation de contrainte d'unicité) porte, sur PostgreSQL, un `meta.target` qui
// liste les colonnes de la contrainte violée (vérifié empiriquement contre le schéma de ce
// projet : `["sku"]`, `["productId","label"]`, `["slug"]`…). Une ressource peut porter
// plusieurs contraintes d'unicité distinctes (voir Variant : `sku` ET `(productId,
// libelle)`) — sans distinguer laquelle a été violée, l'appelant ne peut pas rattacher un
// message d'erreur français au bon champ du formulaire.
export function isUniqueViolation(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2002') return false
  const target = error.meta?.['target']
  return Array.isArray(target) && target.includes(column)
}
