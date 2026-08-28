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

/**
 * Épinglage refusé : l'avis visé n'est pas (ou n'est plus) publié.
 *
 * L'invariant est le même que celui qui fait dépunaiser `modererAvis` quand elle rejette :
 * épinglé sans être en vitrine, un avis n'apparaîtrait NULLE PART, et rien ne l'expliquerait
 * à la propriétaire. Il doit vivre dans l'action serveur, pas seulement dans <ActionsAvis> :
 * une Server Action exportée est un point d'entrée POST à part entière, et deux onglets
 * ouverts sur la liste suffisent à la joindre avec un rendu périmé.
 */
export class AvisNonPublieError extends AvisError {
  constructor(public readonly statut: string) {
    super("Seul un avis publié peut être épinglé sur la page d'accueil.")
  }
}

/**
 * Décision de modération forgée, refusée avant d'atteindre l'énumération PostgreSQL.
 *
 * Même parti pris que `changerStatut` côté commandes (src/app/admin/commandes/actions.ts) :
 * sans ce refus, une valeur inconnue traverse l'action et remonte en
 * `PrismaClientValidationError` brute — « Invalid value for argument `statut`. Expected
 * StatutAvis. » — jusque sous les yeux de l'administratrice.
 */
export class StatutAvisInvalideError extends AvisError {
  constructor(public readonly valeur: string) {
    super(`Statut d'avis inconnu : ${valeur}`)
  }
}
