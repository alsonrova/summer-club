'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { requireAdmin } from '@/server/auth'
import { recordAudit } from '@/server/audit'
import {
  ReviewNotPublishedError,
  InvalidPinError,
  ProductNotFoundError,
  InvalidReviewStatusError,
} from '@/server/reviews'
import type { ValidationErrors } from '@/admin/engine/actions'
import { isModerationStatus, type ModerationStatus } from './query'
import type { ReviewActionState, TestimonialFormState } from './states'

// Convention de sécurité (voir src/server/auth.ts) : chaque Server Action appelle
// requireAdmin() elle-même, en première instruction.

// Convention sur les IDENTIFIANTS, alignée sur ce qui existe déjà côté commandes et côté
// produits — et donc DÉLIBÉRÉMENT pas une troisième façon de faire.
//
// Les quatre appels Prisma de `pinReview` et de `moderateReview` (`findUniqueOrThrow` puis
// `update`, dans chacune) reçoivent `id` du client sans le valider à part. Ce n'est pas un
// oubli : un identifiant d'avis est un `cuid` qui n'existe nulle part dans l'interface
// autrement que copié d'une ligne réellement affichée. Un identifiant absent de l'interface
// est donc forgé — c'est un DÉFAUT, pas une faute de saisie que la propriétaire pourrait
// corriger. `findUniqueOrThrow` lève alors P2025, l'action s'interrompt, et les adaptateurs
// de formulaire ci-dessous laissent cette erreur REMONTER au lieu de la traduire : c'est le
// même parti pris que `uploadMedia` (src/app/admin/produits/actions.ts, « un identifiant
// absent de l'interface, donc forgé ») et que `changeStatus` côté commandes, dont le test
// « laisse remonter une panne technique au lieu de la déguiser en message métier » fixe la
// règle. Un `z.cuid()` de plus n'ajouterait rien : il refuserait les mêmes appels, un cran
// plus tôt, avec un message que personne ne doit jamais lire.
//
// Les valeurs d'ÉNUMÉRATION et le booléen d'épinglage, eux, sont validés : ils peuvent
// atteindre la base et y produire une erreur brute (voir les gardes ci-dessous), alors qu'un
// identifiant inconnu n'y produit qu'un « enregistrement introuvable » sans ambiguïté.

const testimonialSchema = z.object({
  productId: z.string().nullable(),
  note: z.number().int().min(1, 'La note va de 1 à 5').max(5, 'La note va de 1 à 5'),
  texte: z.string().trim().min(5, 'Le témoignage doit faire au moins cinq caractères'),
  auteur: z.string().trim().min(1, "Le nom de l'autrice est requis"),
})

/** Chemins dont le rendu dépend des avis : page d'accueil (avis épinglés) et vitrine. */
function revalidateReviewPaths() {
  revalidatePath('/')
  revalidatePath('/boutique')
  revalidatePath('/admin/avis')
}

/**
 * Saisie manuelle d'un témoignage reçu hors du site (message WhatsApp, commentaire
 * Instagram, mot laissé en boutique).
 *
 * `source: 'importe'`, JAMAIS 'verifie' : le badge « Achat vérifié » de la vitrine est
 * réservé aux avis réellement rattachés à une commande livrée (`orderId`), et il perdrait
 * tout sens si l'administration pouvait le fabriquer à la main. C'est l'invariant central
 * de cet écran — le champ n'est donc ni dans le schéma de saisie ni dans le formulaire, et
 * `orderId` reste nul.
 *
 * `statut: 'publie'` en revanche : la propriétaire vient de saisir ce texte elle-même, le
 * faire repasser par sa propre file de modération n'aurait aucun sens.
 */
export async function importTestimonial(input: unknown) {
  const session = await requireAdmin()
  const validated = testimonialSchema.parse(input)

  // Vérifié avant l'écriture : un productId absent produirait sinon une violation de clé
  // étrangère (P2003) brute au lieu d'un message lisible.
  if (validated.productId !== null) {
    const product = await prisma.product.findUnique({ where: { id: validated.productId } })
    if (!product) throw new ProductNotFoundError(validated.productId)
  }

  const review = await prisma.review.create({
    data: { ...validated, source: 'importe', statut: 'publie' },
  })

  await recordAudit({
    actor: session.user.email,
    action: 'importer_temoignage',
    entity: 'Review',
    entityId: review.id,
    after: { auteur: review.auteur, note: review.note, source: review.source, statut: review.statut },
  })

  revalidateReviewPaths()
  return review
}

/**
 * Bascule la mise en avant d'un avis sur la page d'accueil.
 *
 * L'invariant « un avis non publié ne s'épingle pas » est appliqué ICI, et pas seulement
 * dans <ReviewActions> qui masque le bouton : cette fonction est exportée d'un fichier
 * `'use server'`, c'est donc un point d'entrée POST à part entière, et un garde-fou posé
 * dans un composant client ne protège rien. Le scénario n'a rien de théorique — deux
 * onglets ouverts sur la liste des avis publiés, l'onglet B rejette un avis, l'onglet A
 * resté sur l'ancien rendu clique « Épingler ». Épinglé sans être en vitrine, l'avis
 * n'apparaîtrait nulle part.
 *
 * Le DÉPUNAISAGE (`epingle` faux) reste toujours permis, quel que soit le statut : il
 * ramène vers l'état cohérent — c'est d'ailleurs ce que fait `moderateReview` en rejetant.
 * L'interdire enfermerait un avis déjà épinglé hors vitrine.
 *
 * IDEMPOTENTE, comme `moderateReview` : voir le garde en fin de fonction.
 */
export async function pinReview(id: string, pinned: boolean) {
  const session = await requireAdmin()

  // `pinned` arrive du client, exactement comme `status` dans `moderateReview` juste en
  // dessous : même genre de point d'entrée POST, même absence de typage à l'exécution, donc
  // même garde — en première instruction utile, avant même la lecture. Sans lui, `'oui'`
  // (truthy) franchit l'invariant « seul un avis publié s'épingle » comme un vrai `true`,
  // `undefined` (falsy) le franchit par la porte du dépunaisage, et c'est `prisma.review
  // .update` qui échoue, en `PrismaClientValidationError` brute sous les yeux de
  // l'administratrice.
  if (typeof pinned !== 'boolean') {
    throw new InvalidPinError(String(pinned))
  }

  const before = await prisma.review.findUniqueOrThrow({ where: { id } })

  if (pinned && before.statut !== 'publie') {
    throw new ReviewNotPublishedError(before.statut)
  }

  // IDEMPOTENTE, comme `moderateReview` : une bascule qui ne bascule rien n'écrit rien et ne
  // journalise rien. Le bouton étant lié à `!avis.epingle`, deux onglets affichant tous deux
  // un avis non épinglé envoient tous deux `true` — le second n'épinglait rien mais inscrivait
  // quand même « epingle: true → true » au journal, c'est-à-dire un changement qui n'a pas eu
  // lieu. APRÈS l'invariant, jamais avant : un avis épinglé hors vitrine est justement l'état
  // que l'invariant existe pour empêcher, on ne le confirme pas en silence.
  if (before.epingle === pinned) {
    return before
  }

  const review = await prisma.review.update({ where: { id }, data: { epingle: pinned } })

  await recordAudit({
    actor: session.user.email,
    action: 'epingler_avis',
    entity: 'Review',
    entityId: id,
    before: { epingle: before.epingle },
    after: { epingle: review.epingle },
  })

  revalidateReviewPaths()
  return review
}

/**
 * Modération : publier ou rejeter un avis.
 *
 * Un avis rejeté est dépunaisé au passage — laisser `epingle` à vrai sur un avis retiré de
 * la vitrine créerait un état incohérent que la page d'accueil devrait rattraper seule.
 *
 * IDEMPOTENTE : une décision qui ne change rien n'écrit rien et ne journalise rien. C'est
 * l'équivalent serveur des deux garde-fous de <ReviewActions>, qui n'offre pas « Publier » sur
 * un avis déjà publié ni « Rejeter » sur un avis déjà rejeté. Ils ne vivaient jusqu'ici que
 * dans le composant client, donc nulle part : un onglet resté sur un rendu périmé les
 * contourne, et le journal d'audit — seule mémoire de ce qui est arrivé à un avis —
 * enregistrait alors un changement qui n'avait pas eu lieu, `avant` et `apres` identiques.
 *
 * La comparaison porte sur l'ÉTAT VISÉ ENTIER, pas sur le seul statut : un avis rejeté resté
 * épinglé (état que le dépunaisage au rejet existe justement pour empêcher) doit encore
 * pouvoir être ramené à la cohérence par un second rejet.
 */
export async function moderateReview(id: string, status: ModerationStatus) {
  const session = await requireAdmin()

  // `status` arrive du client : même parti pris que `changeStatus` côté commandes
  // (src/app/admin/commandes/actions.ts). Sans ce refus, une valeur forgée traverse
  // l'action et remonte en `PrismaClientValidationError` brute depuis l'énumération
  // PostgreSQL — « Invalid value for argument `statut`. Expected StatutAvis. » — jusque
  // sous les yeux de l'administratrice. `en_attente` est refusé lui aussi : c'est l'état
  // d'entrée de la file, pas une décision de modération.
  if (!isModerationStatus(status)) {
    throw new InvalidReviewStatusError(String(status))
  }

  const before = await prisma.review.findUniqueOrThrow({ where: { id } })

  // L'état visé, calculé une fois : il sert à décider s'il y a quelque chose à faire, puis à
  // le faire. Deux expressions séparées finiraient par diverger.
  const targetPinned = status === 'rejete' ? false : before.epingle
  if (before.statut === status && before.epingle === targetPinned) {
    return before
  }

  const review = await prisma.review.update({
    where: { id },
    data: { statut: status, epingle: targetPinned },
  })

  await recordAudit({
    actor: session.user.email,
    action: 'moderer_avis',
    entity: 'Review',
    entityId: id,
    before: { statut: before.statut, epingle: before.epingle },
    after: { statut: review.statut, epingle: review.epingle },
  })

  revalidateReviewPaths()
  return review
}

// ---------------------------------------------------------------------------
// Adaptateurs useActionState. Next.js prescrit de RETOURNER les erreurs attendues plutôt
// que de les lever (node_modules/next/dist/docs/01-app/01-getting-started/
// 10-error-handling.md, « Handling expected errors »). Les fonctions ci-dessus gardent la
// signature métier déclarée au brief ; ces enveloppes leur donnent la forme qu'attend un
// <form>.
// ---------------------------------------------------------------------------

function submittedValues(formData: FormData): Record<string, unknown> {
  return {
    productId: String(formData.get('productId') ?? ''),
    note: String(formData.get('note') ?? ''),
    texte: String(formData.get('texte') ?? ''),
    auteur: String(formData.get('auteur') ?? ''),
  }
}

export async function importTestimonialFromForm(
  _previousState: TestimonialFormState,
  formData: FormData,
): Promise<TestimonialFormState> {
  await requireAdmin()

  const rawProductId = String(formData.get('productId') ?? '')
  const rawNote = String(formData.get('note') ?? '')

  const input = {
    // Le <select> renvoie la chaîne vide pour « Aucun produit en particulier » : la colonne
    // Prisma, elle, veut null.
    productId: rawProductId === '' ? null : rawProductId,
    note: rawNote === '' ? Number.NaN : Number(rawNote),
    texte: String(formData.get('texte') ?? ''),
    auteur: String(formData.get('auteur') ?? ''),
  }

  const parsed = testimonialSchema.safeParse(input)
  if (!parsed.success) {
    const errors: ValidationErrors = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.length > 0 ? String(issue.path[0]) : '_racine'
      ;(errors[key] ??= []).push(issue.message)
    }
    return { success: false, errors, initialValues: submittedValues(formData) }
  }

  try {
    await importTestimonial(parsed.data)
  } catch (error) {
    // Seul cas attendu ici : le produit choisi a été supprimé entre l'affichage du
    // formulaire et son envoi. Tout le reste remonte (y compris la redirection de
    // requireAdmin(), qui s'implémente par un throw).
    if (error instanceof ProductNotFoundError) {
      return {
        success: false,
        errors: { productId: ["Ce produit n'existe plus. Rechargez la page."] },
        initialValues: submittedValues(formData),
      }
    }
    throw error
  }

  return { success: true, errors: {}, initialValues: {} }
}

export async function pinReviewFromForm(
  id: string,
  pinned: boolean,
  _previousState: ReviewActionState,
  _formData: FormData,
): Promise<ReviewActionState> {
  await requireAdmin()

  try {
    await pinReview(id, pinned)
  } catch (error) {
    // Seul cas attendu ici : l'avis a changé de statut depuis le rendu de la page (un autre
    // onglet, la propriétaire elle-même). C'est une situation normale, qui doit se lire en
    // français sous le bouton — pas une panne. Tout le reste remonte, y compris la
    // redirection de requireAdmin(), qui s'implémente par un throw.
    if (error instanceof ReviewNotPublishedError) {
      return {
        error:
          "Cet avis n'est pas publié : seul un avis en vitrine peut être épinglé sur la "
          + "page d'accueil. Rechargez la page.",
      }
    }
    // Même traduction que celle du statut forgé côté modération : ni valeur brute, ni nom de
    // classe d'erreur sous les yeux de la propriétaire.
    if (error instanceof InvalidPinError) {
      return { error: "Cette action d'épinglage est inconnue. Rechargez la page." }
    }
    throw error
  }

  return { error: null }
}

export async function moderateReviewFromForm(
  id: string,
  status: ModerationStatus,
  _previousState: ReviewActionState,
  _formData: FormData,
): Promise<ReviewActionState> {
  await requireAdmin()

  try {
    await moderateReview(id, status)
  } catch (error) {
    if (error instanceof InvalidReviewStatusError) {
      return { error: 'Cette décision de modération est inconnue. Rechargez la page.' }
    }
    throw error
  }

  return { error: null }
}
