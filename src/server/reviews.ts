/**
 * Erreurs métier des avis. Même parti pris que la famille dérivée de `CommandeError`
 * (src/server/orders.ts) : une classe, pas une chaîne de message.
 *
 * Ces classes ne peuvent pas vivre dans `src/app/admin/avis/actions.ts` : un fichier
 * marqué `'use server'` ne peut exporter que des fonctions async
 * (https://nextjs.org/docs/messages/invalid-use-server-value). Elles ont pourtant besoin
 * d'être partagées entre l'action métier qui les lève et l'enveloppe de formulaire qui les
 * traduit en message pour la propriétaire — comparer des messages d'erreur pour décider
 * quoi afficher casserait à la première reformulation, sans que rien ne l'annonce.
 */
export class AvisError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** Le produit rattaché au témoignage n'existe pas (ou plus). */
export class ProduitIntrouvableError extends AvisError {
  constructor(public readonly productId: string) {
    super("Ce produit n'existe pas.")
  }
}
