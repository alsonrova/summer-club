import { Prisma } from '@prisma/client'

// P2002 (violation de contrainte d'unicité) porte, sur PostgreSQL, un `meta.target` qui
// liste les colonnes de la contrainte violée (vérifié empiriquement contre le schéma de ce
// projet : `["sku"]`, `["productId","libelle"]`, `["slug"]`…). Une ressource peut porter
// plusieurs contraintes d'unicité distinctes (voir Variant : `sku` ET `(productId,
// libelle)`) — sans distinguer laquelle a été violée, l'appelant ne peut pas rattacher un
// message d'erreur français au bon champ du formulaire.
export function estViolationUnicite(erreur: unknown, colonne: string): boolean {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (erreur.code !== 'P2002') return false
  const cible = erreur.meta?.['target']
  return Array.isArray(cible) && cible.includes(colonne)
}
