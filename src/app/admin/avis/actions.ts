'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { requireAdmin } from '@/server/auth'
import { enregistrerAudit } from '@/server/audit'
import {
  AvisNonPublieError,
  ProduitIntrouvableError,
  StatutAvisInvalideError,
} from '@/server/reviews'
import type { ErreursValidation } from '@/admin/engine/actions'
import { estStatutModeration, type StatutModeration } from './query'
import type { EtatActionAvis, EtatFormulaireTemoignage } from './etats'

// Convention de sécurité (voir src/server/auth.ts) : chaque Server Action appelle
// requireAdmin() elle-même, en première instruction.

const temoignageSchema = z.object({
  productId: z.string().nullable(),
  note: z.number().int().min(1, 'La note va de 1 à 5').max(5, 'La note va de 1 à 5'),
  texte: z.string().trim().min(5, 'Le témoignage doit faire au moins cinq caractères'),
  auteur: z.string().trim().min(1, "Le nom de l'autrice est requis"),
})

/** Chemins dont le rendu dépend des avis : page d'accueil (avis épinglés) et vitrine. */
function revaliderAvis() {
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
export async function importerTemoignage(donnees: unknown) {
  const session = await requireAdmin()
  const valide = temoignageSchema.parse(donnees)

  // Vérifié avant l'écriture : un productId absent produirait sinon une violation de clé
  // étrangère (P2003) brute au lieu d'un message lisible.
  if (valide.productId !== null) {
    const produit = await prisma.product.findUnique({ where: { id: valide.productId } })
    if (!produit) throw new ProduitIntrouvableError(valide.productId)
  }

  const avis = await prisma.review.create({
    data: { ...valide, source: 'importe', statut: 'publie' },
  })

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'importer_temoignage',
    entite: 'Review',
    entiteId: avis.id,
    apres: { auteur: avis.auteur, note: avis.note, source: avis.source, statut: avis.statut },
  })

  revaliderAvis()
  return avis
}

/**
 * Bascule la mise en avant d'un avis sur la page d'accueil.
 *
 * L'invariant « un avis non publié ne s'épingle pas » est appliqué ICI, et pas seulement
 * dans <ActionsAvis> qui masque le bouton : cette fonction est exportée d'un fichier
 * `'use server'`, c'est donc un point d'entrée POST à part entière, et un garde-fou posé
 * dans un composant client ne protège rien. Le scénario n'a rien de théorique — deux
 * onglets ouverts sur la liste des avis publiés, l'onglet B rejette un avis, l'onglet A
 * resté sur l'ancien rendu clique « Épingler ». Épinglé sans être en vitrine, l'avis
 * n'apparaîtrait nulle part.
 *
 * Le DÉPUNAISAGE (`epingle` faux) reste toujours permis, quel que soit le statut : il
 * ramène vers l'état cohérent — c'est d'ailleurs ce que fait `modererAvis` en rejetant.
 * L'interdire enfermerait un avis déjà épinglé hors vitrine.
 */
export async function epinglerAvis(id: string, epingle: boolean) {
  const session = await requireAdmin()

  const avant = await prisma.review.findUniqueOrThrow({ where: { id } })

  if (epingle && avant.statut !== 'publie') {
    throw new AvisNonPublieError(avant.statut)
  }

  const avis = await prisma.review.update({ where: { id }, data: { epingle } })

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'epingler_avis',
    entite: 'Review',
    entiteId: id,
    avant: { epingle: avant.epingle },
    apres: { epingle: avis.epingle },
  })

  revaliderAvis()
  return avis
}

/**
 * Modération : publier ou rejeter un avis.
 *
 * Un avis rejeté est dépunaisé au passage — laisser `epingle` à vrai sur un avis retiré de
 * la vitrine créerait un état incohérent que la page d'accueil devrait rattraper seule.
 */
export async function modererAvis(id: string, statut: StatutModeration) {
  const session = await requireAdmin()

  // `statut` arrive du client : même parti pris que `changerStatut` côté commandes
  // (src/app/admin/commandes/actions.ts). Sans ce refus, une valeur forgée traverse
  // l'action et remonte en `PrismaClientValidationError` brute depuis l'énumération
  // PostgreSQL — « Invalid value for argument `statut`. Expected StatutAvis. » — jusque
  // sous les yeux de l'administratrice. `en_attente` est refusé lui aussi : c'est l'état
  // d'entrée de la file, pas une décision de modération.
  if (!estStatutModeration(statut)) {
    throw new StatutAvisInvalideError(String(statut))
  }

  const avant = await prisma.review.findUniqueOrThrow({ where: { id } })
  const avis = await prisma.review.update({
    where: { id },
    data: { statut, ...(statut === 'rejete' ? { epingle: false } : {}) },
  })

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'moderer_avis',
    entite: 'Review',
    entiteId: id,
    avant: { statut: avant.statut, epingle: avant.epingle },
    apres: { statut: avis.statut, epingle: avis.epingle },
  })

  revaliderAvis()
  return avis
}

// ---------------------------------------------------------------------------
// Adaptateurs useActionState. Next.js prescrit de RETOURNER les erreurs attendues plutôt
// que de les lever (node_modules/next/dist/docs/01-app/01-getting-started/
// 10-error-handling.md, « Handling expected errors »). Les fonctions ci-dessus gardent la
// signature métier déclarée au brief ; ces enveloppes leur donnent la forme qu'attend un
// <form>.
// ---------------------------------------------------------------------------

function valeursSoumises(formData: FormData): Record<string, unknown> {
  return {
    productId: String(formData.get('productId') ?? ''),
    note: String(formData.get('note') ?? ''),
    texte: String(formData.get('texte') ?? ''),
    auteur: String(formData.get('auteur') ?? ''),
  }
}

export async function importerTemoignageDepuisFormulaire(
  _etatPrecedent: EtatFormulaireTemoignage,
  formData: FormData,
): Promise<EtatFormulaireTemoignage> {
  await requireAdmin()

  const productIdBrut = String(formData.get('productId') ?? '')
  const noteBrute = String(formData.get('note') ?? '')

  const donnees = {
    // Le <select> renvoie la chaîne vide pour « Aucun produit en particulier » : la colonne
    // Prisma, elle, veut null.
    productId: productIdBrut === '' ? null : productIdBrut,
    note: noteBrute === '' ? Number.NaN : Number(noteBrute),
    texte: String(formData.get('texte') ?? ''),
    auteur: String(formData.get('auteur') ?? ''),
  }

  const analyse = temoignageSchema.safeParse(donnees)
  if (!analyse.success) {
    const erreurs: ErreursValidation = {}
    for (const probleme of analyse.error.issues) {
      const cle = probleme.path.length > 0 ? String(probleme.path[0]) : '_racine'
      ;(erreurs[cle] ??= []).push(probleme.message)
    }
    return { succes: false, erreurs, valeursInitiales: valeursSoumises(formData) }
  }

  try {
    await importerTemoignage(analyse.data)
  } catch (erreur) {
    // Seul cas attendu ici : le produit choisi a été supprimé entre l'affichage du
    // formulaire et son envoi. Tout le reste remonte (y compris la redirection de
    // requireAdmin(), qui s'implémente par un throw).
    if (erreur instanceof ProduitIntrouvableError) {
      return {
        succes: false,
        erreurs: { productId: ["Ce produit n'existe plus. Rechargez la page."] },
        valeursInitiales: valeursSoumises(formData),
      }
    }
    throw erreur
  }

  return { succes: true, erreurs: {}, valeursInitiales: {} }
}

export async function epinglerAvisDepuisFormulaire(
  id: string,
  epingle: boolean,
  _etatPrecedent: EtatActionAvis,
  _formData: FormData,
): Promise<EtatActionAvis> {
  await requireAdmin()

  try {
    await epinglerAvis(id, epingle)
  } catch (erreur) {
    // Seul cas attendu ici : l'avis a changé de statut depuis le rendu de la page (un autre
    // onglet, la propriétaire elle-même). C'est une situation normale, qui doit se lire en
    // français sous le bouton — pas une panne. Tout le reste remonte, y compris la
    // redirection de requireAdmin(), qui s'implémente par un throw.
    if (erreur instanceof AvisNonPublieError) {
      return {
        erreur:
          "Cet avis n'est pas publié : seul un avis en vitrine peut être épinglé sur la "
          + "page d'accueil. Rechargez la page.",
      }
    }
    throw erreur
  }

  return { erreur: null }
}

export async function modererAvisDepuisFormulaire(
  id: string,
  statut: StatutModeration,
  _etatPrecedent: EtatActionAvis,
  _formData: FormData,
): Promise<EtatActionAvis> {
  await requireAdmin()

  try {
    await modererAvis(id, statut)
  } catch (erreur) {
    if (erreur instanceof StatutAvisInvalideError) {
      return { erreur: 'Cette décision de modération est inconnue. Rechargez la page.' }
    }
    throw erreur
  }

  return { erreur: null }
}
