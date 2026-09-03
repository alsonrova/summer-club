'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/server/db'
import { requireAdmin } from '@/server/auth'
import { recordAudit } from '@/server/audit'
import {
  processImage,
  validateMediaFile,
  deleteMediaFiles,
  UnreadableImageError,
} from '@/server/media'
import { isUniqueViolation } from '@/server/prisma-erreurs'
import { validerFormData, formDataVersObjet } from '@/admin/engine/actions'
import { productsResource } from '@/admin/resources/products'
import { variantsResource } from '@/admin/resources/variants'
import type {
  EtatFormulaireProduit,
  EtatFormulaireDeclinaison,
  EtatActionSimple,
} from './etats'

// Convention d'administration (voir src/server/auth.ts) : un layout ne protège ni les
// Server Actions ni les Route Handlers — chaque action ici appelle requireAdmin() elle-même,
// même si les briques du moteur qu'elle invoque (validerFormData, recordAudit) le font
// déjà indirectement pour certaines. La lecture de session est mise en cache par requête
// (React cache()), ce doublon ne coûte donc rien.

// Next.js 16 (voir node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md,
// section « Handling expected errors ») : les erreurs de validation attendues (un prix
// négatif, un stock invalide, un fichier refusé) doivent être modélisées comme des valeurs
// de retour consommées par useActionState côté client, pas levées avec throw — lever ne
// convient qu'aux erreurs réellement inattendues (ex. findUniqueOrThrow sur un id forgé).
//
// EtatFormulaireProduit/EtatActionSimple (et leurs valeurs initiales) vivent dans ./etats.ts,
// pas ici : un fichier 'use server' ne peut exporter que des fonctions async (voir
// https://nextjs.org/docs/messages/invalid-use-server-value).

// Borne haute d'un entier PostgreSQL (colonnes `Int`) : les champs validés directement ici
// (pas via un schéma Zod — `ajusterStock`/`reordonnerMedia` analysent `FormData` à la main)
// doivent la respecter tout autant que ceux de productSchema/variantSchema, sous peine de
// laisser passer une valeur que Prisma refuserait avec une erreur non gérée.
const ENTIER_POSTGRES_MAX = 2147483647

export async function creerProduit(
  _etatPrecedent: EtatFormulaireProduit,
  formData: FormData,
): Promise<EtatFormulaireProduit> {
  const session = await requireAdmin()
  const resultat = validerFormData(productsResource, formData)

  if (!resultat.succes) {
    return {
      succes: false,
      erreurs: resultat.erreurs,
      valeursInitiales: formDataVersObjet(formData, productsResource),
    }
  }

  let produit
  try {
    produit = await prisma.product.create({ data: resultat.donnees })
  } catch (erreur) {
    if (isUniqueViolation(erreur, 'slug')) {
      return {
        succes: false,
        erreurs: { slug: ['Ce slug est déjà utilisé par un autre produit.'] },
        valeursInitiales: formDataVersObjet(formData, productsResource),
      }
    }
    throw erreur
  }

  await recordAudit({
    actor: session.user.email,
    action: 'creer',
    entity: 'produits',
    entityId: produit.id,
    after: resultat.donnees,
  })

  // Le catalogue public lit ces mêmes produits : sans cette invalidation, une création
  // resterait invisible en boutique jusqu'à l'expiration naturelle du cache.
  revalidatePath('/boutique')
  revalidatePath('/admin/produits')
  redirect(`/admin/produits/${produit.id}`)
}

export async function modifierProduit(
  productId: string,
  _etatPrecedent: EtatFormulaireProduit,
  formData: FormData,
): Promise<EtatFormulaireProduit> {
  const session = await requireAdmin()
  const resultat = validerFormData(productsResource, formData)

  if (!resultat.succes) {
    return {
      succes: false,
      erreurs: resultat.erreurs,
      valeursInitiales: formDataVersObjet(formData, productsResource),
    }
  }

  const avantComplet = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
  // Restreint aux mêmes clés que `resultat.donnees` (les champs réellement modifiés) :
  // sans ce filtrage, `avant` porterait aussi des dates et des colonnes absentes du
  // formulaire, rendant `avant`/`apres` non comparables champ à champ dans le journal
  // d'audit — alors que c'est précisément sa raison d'être.
  const avantMemesClefs = Object.fromEntries(
    Object.keys(resultat.donnees).map((cle) => [
      cle,
      (avantComplet as Record<string, unknown>)[cle],
    ]),
  )

  try {
    await prisma.product.update({ where: { id: productId }, data: resultat.donnees })
  } catch (erreur) {
    if (isUniqueViolation(erreur, 'slug')) {
      return {
        succes: false,
        erreurs: { slug: ['Ce slug est déjà utilisé par un autre produit.'] },
        valeursInitiales: formDataVersObjet(formData, productsResource),
      }
    }
    throw erreur
  }

  await recordAudit({
    actor: session.user.email,
    action: 'modifier',
    entity: 'produits',
    entityId: productId,
    before: avantMemesClefs,
    after: resultat.donnees,
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${productId}`)

  return { succes: true, erreurs: {}, valeursInitiales: resultat.donnees }
}

export async function creerDeclinaison(
  productId: string,
  _etatPrecedent: EtatFormulaireDeclinaison,
  formData: FormData,
): Promise<EtatFormulaireDeclinaison> {
  const session = await requireAdmin()
  const resultat = validerFormData(variantsResource, formData)

  if (!resultat.succes) {
    return {
      succes: false,
      erreurs: resultat.erreurs,
      valeursInitiales: formDataVersObjet(formData, variantsResource),
    }
  }

  const produit = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
  const prixResultant = produit.prixBase + resultat.donnees.deltaPrix
  if (prixResultant <= 0) {
    return {
      succes: false,
      erreurs: {
        deltaPrix: ['Le prix de vente résultant (prix de base + écart) doit être positif.'],
      },
      valeursInitiales: formDataVersObjet(formData, variantsResource),
    }
  }

  let variant
  try {
    variant = await prisma.variant.create({ data: { productId, ...resultat.donnees } })
  } catch (erreur) {
    // Deux contraintes d'unicité distinctes sur Variant (voir prisma/schema.prisma) :
    // `sku` (globale) et `(productId, libelle)` (par produit). Sans les distinguer,
    // la propriétaire verrait une erreur technique au premier doublon.
    if (isUniqueViolation(erreur, 'sku')) {
      return {
        succes: false,
        erreurs: { sku: ['Ce SKU est déjà utilisé par une autre déclinaison.'] },
        valeursInitiales: formDataVersObjet(formData, variantsResource),
      }
    }
    if (isUniqueViolation(erreur, 'libelle')) {
      return {
        succes: false,
        erreurs: { libelle: ['Une déclinaison avec ce libellé existe déjà pour ce produit.'] },
        valeursInitiales: formDataVersObjet(formData, variantsResource),
      }
    }
    throw erreur
  }

  await recordAudit({
    actor: session.user.email,
    action: 'creer',
    entity: 'Variant',
    entityId: variant.id,
    after: resultat.donnees,
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${productId}`)

  return { succes: true, erreurs: {}, valeursInitiales: {} }
}

export async function ajusterStock(
  variantId: string,
  _etatPrecedent: EtatActionSimple,
  formData: FormData,
): Promise<EtatActionSimple> {
  const session = await requireAdmin()

  const brut = formData.get('stock')
  const nouveauStock = Number(brut)
  if (
    brut === null ||
    brut === '' ||
    !Number.isInteger(nouveauStock) ||
    nouveauStock < 0 ||
    nouveauStock > ENTIER_POSTGRES_MAX
  ) {
    return { erreur: 'Le stock doit être un entier positif ou nul.' }
  }

  const avant = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
  const apres = await prisma.variant.update({
    where: { id: variantId },
    data: { stock: nouveauStock },
  })

  // Seule trace qui permettra plus tard de comprendre un écart d'inventaire : l'ancienne
  // ET la nouvelle valeur, jamais l'une sans l'autre.
  await recordAudit({
    actor: session.user.email,
    action: 'ajustement_stock',
    entity: 'Variant',
    entityId: variantId,
    before: { stock: avant.stock },
    after: { stock: apres.stock },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${avant.productId}`)

  return { erreur: null }
}

export async function televerserMedia(
  productId: string,
  _etatPrecedent: EtatActionSimple,
  formData: FormData,
): Promise<EtatActionSimple> {
  const session = await requireAdmin()

  const fichier = formData.get('fichier')
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Aucun fichier sélectionné.' }
  }

  const erreurValidation = validateMediaFile(fichier)
  if (erreurValidation) {
    return { erreur: erreurValidation }
  }

  // Nom du produit lu avant tout traitement : il sert de texte alternatif de départ (voir
  // plus bas). Sur un productId inexistant, findUniqueOrThrow ne retourne pas une erreur —
  // elle LÈVE (Prisma P2025), et l'action s'interrompt sans être rattrapée. Ce n'est pas une
  // entorse à la conception « erreurs retournées, pas levées » de ce fichier : celle-ci vise
  // les fautes de saisie que la propriétaire peut corriger, pas un identifiant absent de
  // l'interface, donc forgé. L'intérêt de placer cette lecture ici est de sortir avant
  // d'écrire six fichiers que plus aucune ligne ne référencerait.
  const produit = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { nom: true },
  })

  const buffer = Buffer.from(await fichier.arrayBuffer())
  // processImage assainit le nom et y ajoute elle-même un suffixe aléatoire d'unicité :
  // inutile d'horodater ici, et surtout ne jamais lui passer le nom envoyé par le
  // navigateur (fichier.name) — seul l'identifiant du produit, déjà validé, lui est confié.
  //
  // Un fichier au type MIME usurpé (un PDF renommé en .jpg, une image tronquée, un format
  // que sharp refuse malgré un en-tête accepté par validateMediaFile) fait lever
  // processImage : conformément à la conception « erreurs retournées, pas levées » de ce
  // fichier, on l'attrape ici plutôt que de laisser l'action entière planter avec une
  // trace technique.
  let chemin: string
  try {
    ;({ chemin } = await processImage(buffer, productId))
  } catch (erreur) {
    // Journalisé dans tous les cas, avec l'erreur réelle : sans cette trace, un disque
    // plein ou des droits refusés sur public/uploads seraient indiscernables côté serveur
    // d'un fichier corrompu, donc indiagnosticables.
    console.error('[televerserMedia] échec du traitement de l’image', { productId, erreur })

    // Seul le vrai échec de décodage (UnreadableImageError, levée par le seul encodage —
    // voir src/server/media.ts) mérite d'être imputé au fichier envoyé.
    if (erreur instanceof UnreadableImageError) {
      return {
        erreur:
          "Cette image n'a pas pu être lue. Vérifiez qu'il s'agit bien d'une photo JPEG, PNG, WebP ou AVIF.",
      }
    }
    // Tout le reste (écriture disque impossible, dossier inaccessible) est une panne du
    // serveur : le dire, plutôt que de laisser croire que la photo est en cause.
    return {
      erreur:
        "Le téléversement a échoué pour une raison technique. Réessayez ; si le problème persiste, prévenez votre développeur.",
    }
  }

  const compte = await prisma.media.count({ where: { productId } })
  const media = await prisma.media.create({
    data: {
      productId,
      chemin,
      // Texte alternatif de départ dérivé du nom du produit, jamais la chaîne vide :
      // modifierAltMedia refuse un alt vide, une photo fraîchement téléversée se
      // retrouvait donc dans un état que l'éditeur interdit de reproduire, et partait en
      // vitrine sans texte alternatif (accessibilité, référencement). Rendre le champ
      // obligatoire au téléversement aurait été l'autre option : écartée parce qu'elle
      // impose une saisie au milieu du geste courant « j'ajoute mes cinq photos, je les
      // décris ensuite », alors qu'une valeur de départ correcte — et toujours
      // modifiable — garantit le même invariant sans friction. Le nom seul, sans préfixe
      // « Photo de » : l'élément <img> annonce déjà qu'il s'agit d'une image, le répéter
      // dans l'alt est une redondance que les lecteurs d'écran font entendre deux fois.
      alt: produit.nom,
      position: compte,
      isPrimary: compte === 0,
    },
  })

  await recordAudit({
    actor: session.user.email,
    action: 'ajout_media',
    entity: 'Media',
    entityId: media.id,
    after: { chemin },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${productId}`)

  return { erreur: null }
}

// Pas de glisser-déposer (écran hors périmètre de cette tâche, voir le plan) : un simple
// ordre numérique suffit pour réordonner les photos d'un produit.
export async function reordonnerMedia(
  mediaId: string,
  _etatPrecedent: EtatActionSimple,
  formData: FormData,
): Promise<EtatActionSimple> {
  const session = await requireAdmin()

  const brut = formData.get('position')
  const nouvellePosition = Number(brut)
  if (
    brut === null ||
    brut === '' ||
    !Number.isInteger(nouvellePosition) ||
    nouvellePosition < 0 ||
    nouvellePosition > ENTIER_POSTGRES_MAX
  ) {
    return { erreur: 'La position doit être un entier positif ou nul.' }
  }

  const avant = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } })
  const apres = await prisma.media.update({
    where: { id: mediaId },
    data: { position: nouvellePosition },
  })

  await recordAudit({
    actor: session.user.email,
    action: 'reordonner_media',
    entity: 'Media',
    entityId: mediaId,
    before: { position: avant.position },
    after: { position: apres.position },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${avant.productId}`)

  return { erreur: null }
}

export async function modifierAltMedia(
  mediaId: string,
  _etatPrecedent: EtatActionSimple,
  formData: FormData,
): Promise<EtatActionSimple> {
  const session = await requireAdmin()

  const brut = formData.get('alt')
  const alt = typeof brut === 'string' ? brut.trim() : ''
  if (alt === '') {
    return { erreur: 'Le texte alternatif est requis.' }
  }

  const avant = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } })
  await prisma.media.update({ where: { id: mediaId }, data: { alt } })

  await recordAudit({
    actor: session.user.email,
    action: 'modifier_alt_media',
    entity: 'Media',
    entityId: mediaId,
    before: { alt: avant.alt },
    after: { alt },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${avant.productId}`)

  return { erreur: null }
}

export async function definirPhotoPrincipale(
  mediaId: string,
  _etatPrecedent: EtatActionSimple,
  _formData: FormData,
): Promise<EtatActionSimple> {
  const session = await requireAdmin()

  const media = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } })

  // Transaction : un produit qui a des photos en a exactement une principale. Retirer le
  // drapeau des autres photos du même produit et le poser sur celle-ci doivent réussir ou
  // échouer ensemble, sous peine de laisser un produit sans photo principale (ou avec
  // deux) si l'opération est interrompue entre les deux écritures.
  await prisma.$transaction([
    prisma.media.updateMany({
      where: { productId: media.productId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.media.update({ where: { id: mediaId }, data: { isPrimary: true } }),
  ])

  await recordAudit({
    actor: session.user.email,
    action: 'definir_photo_principale',
    entity: 'Media',
    entityId: mediaId,
    before: { isPrimary: media.isPrimary },
    after: { isPrimary: true },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${media.productId}`)

  return { erreur: null }
}

export async function supprimerMedia(
  mediaId: string,
  _etatPrecedent: EtatActionSimple,
  _formData: FormData,
): Promise<EtatActionSimple> {
  const session = await requireAdmin()

  const media = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } })

  // Efface les fichiers avant la ligne en base : si l'effacement disque échouait, mieux
  // vaut une ligne orpheline (photo cassée, visible, corrigible) qu'un fichier orphelin
  // sur disque qu'aucune fiche ne référence plus jamais.
  await deleteMediaFiles(media.chemin)

  await prisma.$transaction(async (tx) => {
    await tx.media.delete({ where: { id: mediaId } })

    // Un produit qui a des photos en a exactement une principale : si celle qu'on vient
    // de supprimer l'était, la suivante (par position) prend le relais.
    if (media.isPrimary) {
      const suivante = await tx.media.findFirst({
        where: { productId: media.productId },
        orderBy: { position: 'asc' },
      })
      if (suivante) {
        await tx.media.update({ where: { id: suivante.id }, data: { isPrimary: true } })
      }
    }
  })

  await recordAudit({
    actor: session.user.email,
    action: 'supprimer_media',
    entity: 'Media',
    entityId: mediaId,
    before: { chemin: media.chemin, alt: media.alt, isPrimary: media.isPrimary },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${media.productId}`)

  return { erreur: null }
}
