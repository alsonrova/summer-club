import { prisma } from '@/server/db'
import type { HomeReview } from '@/components/home/reviews'

// Trois avis épinglés en page d'accueil (spec § 8.4). La borne vit ici plutôt que dans la
// page : c'est la requête qui doit s'arrêter à trois, pas le rendu qui doit en jeter
// quatre.
const HOME_REVIEWS_LIMIT = 3

/**
 * Les avis choisis pour la page d'accueil : épinglés ET publiés.
 *
 * Les deux conditions, pas une seule. `pinned` dit « je veux celui-ci en vitrine »,
 * `status` dit « celui-ci est validé » — et un avis peut porter la première sans la
 * seconde : `moderateReview` dépunaise quand elle rejette, mais rien n'empêche une ligne
 * écrite avant cette règle, ou par un script, d'être épinglée en attente de modération.
 * L'invariant se ferme donc ici aussi, côté lecture (docs/CONVENTIONS.md § 4, règle 2 :
 * un invariant tenu à un seul endroit n'est pas tenu).
 *
 * `position` est l'ordre que la propriétaire choisit au back-office ; `id` départage deux
 * positions égales, sans quoi l'ordre des trois avis dépendrait du plan d'exécution et
 * pourrait changer d'un rendu à l'autre (même raisonnement que MEDIA_ORDER,
 * src/server/products.ts).
 *
 * La projection est explicite : ni `orderId`, ni `productId`, ni `createdAt` ne traversent
 * vers le composant. Ce qui n'est pas projeté ne peut pas fuiter dans le HTML.
 */
export async function listPinnedReviews(): Promise<HomeReview[]> {
  return prisma.review.findMany({
    where: { pinned: true, status: 'published' },
    select: { id: true, rating: true, body: true, author: true, source: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    take: HOME_REVIEWS_LIMIT,
  })
}

/**
 * Erreurs métier des avis. Même parti pris que la famille dérivée de `OrderError`
 * (src/server/orders.ts) : une classe, pas une chaîne de message.
 *
 * Ces classes ne peuvent pas vivre dans `src/app/admin/avis/actions.ts` : un fichier
 * marqué `'use server'` ne peut exporter que des fonctions async
 * (https://nextjs.org/docs/messages/invalid-use-server-value). Elles ont pourtant besoin
 * d'être partagées entre l'action métier qui les lève et l'enveloppe de formulaire qui les
 * traduit en message pour la propriétaire — comparer des messages d'erreur pour décider
 * quoi afficher casserait à la première reformulation, sans que rien ne l'annonce.
 */
export class ReviewError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** Le produit rattaché au témoignage n'existe pas (ou plus). */
export class ProductNotFoundError extends ReviewError {
  constructor(public readonly productId: string) {
    super("Ce produit n'existe pas.")
  }
}

/**
 * Épinglage refusé : l'avis visé n'est pas (ou n'est plus) publié.
 *
 * L'invariant est le même que celui qui fait dépunaiser `moderateReview` quand elle rejette :
 * épinglé sans être en vitrine, un avis n'apparaîtrait NULLE PART, et rien ne l'expliquerait
 * à la propriétaire. Il doit vivre dans l'action serveur, pas seulement dans <ReviewActions> :
 * une Server Action exportée est un point d'entrée POST à part entière, et deux onglets
 * ouverts sur la liste suffisent à la joindre avec un rendu périmé.
 */
export class ReviewNotPublishedError extends ReviewError {
  constructor(public readonly status: string) {
    super("Seul un avis publié peut être épinglé sur la page d'accueil.")
  }
}

/**
 * Décision de modération forgée, refusée avant d'atteindre l'énumération PostgreSQL.
 *
 * Même parti pris que `changeStatus` côté commandes (src/app/admin/commandes/actions.ts) :
 * sans ce refus, une valeur inconnue traverse l'action et remonte en
 * `PrismaClientValidationError` brute — « Invalid value for argument `status`. Expected
 * ReviewStatus. » — jusque sous les yeux de l'administratrice.
 */
export class InvalidReviewStatusError extends ReviewError {
  constructor(public readonly value: string) {
    super(`Statut d'avis inconnu : ${value}`)
  }
}

/**
 * Valeur d'épinglage forgée, refusée avant d'atteindre la colonne booléenne.
 *
 * Jumeau exact de `InvalidReviewStatusError` : `pinReview` est exportée du même fichier
 * `'use server'` que `moderateReview`, c'est donc le même genre de point d'entrée POST, et son
 * paramètre n'est pas plus typé à l'exécution que ne l'était le statut. Sans ce refus, la
 * valeur traverse l'action et remonte en `PrismaClientValidationError` brute — « Argument
 * `pinned`: Invalid value provided. Expected Boolean or BoolFieldUpdateOperationsInput,
 * provided String. », relevée telle quelle sous mutation — c'est-à-dire en 500.
 *
 * Le contrôle porte sur le TYPE, pas sur la véracité : `'oui'` est truthy et franchirait
 * l'invariant « seul un avis publié s'épingle » comme un vrai `true`, tandis qu'`undefined`
 * le franchirait par la porte du dépunaisage, toujours ouverte. Ni l'un ni l'autre ne serait
 * arrêté par un test de valeur.
 */
export class InvalidPinError extends ReviewError {
  constructor(public readonly value: string) {
    super(`Valeur d'épinglage invalide : ${value}`)
  }
}
