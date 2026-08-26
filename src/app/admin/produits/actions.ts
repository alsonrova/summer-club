'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/server/db'
import { requireAdmin } from '@/server/auth'
import { enregistrerAudit } from '@/server/audit'
import { traiterImage, validerFichierMedia, effacerFichiersMedia } from '@/server/media'
import { estViolationUnicite } from '@/server/prisma-erreurs'
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
// même si les briques du moteur qu'elle invoque (validerFormData, enregistrerAudit) le font
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
    if (estViolationUnicite(erreur, 'slug')) {
      return {
        succes: false,
        erreurs: { slug: ['Ce slug est déjà utilisé par un autre produit.'] },
        valeursInitiales: formDataVersObjet(formData, productsResource),
      }
    }
    throw erreur
  }

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'creer',
    entite: 'produits',
    entiteId: produit.id,
    apres: resultat.donnees,
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
    if (estViolationUnicite(erreur, 'slug')) {
      return {
        succes: false,
        erreurs: { slug: ['Ce slug est déjà utilisé par un autre produit.'] },
        valeursInitiales: formDataVersObjet(formData, productsResource),
      }
    }
    throw erreur
  }

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'modifier',
    entite: 'produits',
    entiteId: productId,
    avant: avantMemesClefs,
    apres: resultat.donnees,
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
    if (estViolationUnicite(erreur, 'sku')) {
      return {
        succes: false,
        erreurs: { sku: ['Ce SKU est déjà utilisé par une autre déclinaison.'] },
        valeursInitiales: formDataVersObjet(formData, variantsResource),
      }
    }
    if (estViolationUnicite(erreur, 'libelle')) {
      return {
        succes: false,
        erreurs: { libelle: ['Une déclinaison avec ce libellé existe déjà pour ce produit.'] },
        valeursInitiales: formDataVersObjet(formData, variantsResource),
      }
    }
    throw erreur
  }

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'creer',
    entite: 'Variant',
    entiteId: variant.id,
    apres: resultat.donnees,
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
  await enregistrerAudit({
    acteur: session.user.email,
    action: 'ajustement_stock',
    entite: 'Variant',
    entiteId: variantId,
    avant: { stock: avant.stock },
    apres: { stock: apres.stock },
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

  const erreurValidation = validerFichierMedia(fichier)
  if (erreurValidation) {
    return { erreur: erreurValidation }
  }

  const buffer = Buffer.from(await fichier.arrayBuffer())
  // traiterImage assainit le nom et y ajoute elle-même un suffixe aléatoire d'unicité :
  // inutile d'horodater ici, et surtout ne jamais lui passer le nom envoyé par le
  // navigateur (fichier.name) — seul l'identifiant du produit, déjà validé, lui est confié.
  //
  // Un fichier au type MIME usurpé (un PDF renommé en .jpg, une image tronquée, un format
  // que sharp refuse malgré un en-tête accepté par validerFichierMedia) fait lever
  // traiterImage : conformément à la conception « erreurs retournées, pas levées » de ce
  // fichier, on l'attrape ici plutôt que de laisser l'action entière planter avec une
  // trace technique.
  let chemin: string
  try {
    ;({ chemin } = await traiterImage(buffer, productId))
  } catch {
    return {
      erreur:
        "Cette image n'a pas pu être lue. Vérifiez qu'il s'agit bien d'une photo JPEG, PNG, WebP ou AVIF.",
    }
  }

  const compte = await prisma.media.count({ where: { productId } })
  const media = await prisma.media.create({
    data: { productId, chemin, alt: '', position: compte, isPrimary: compte === 0 },
  })

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'ajout_media',
    entite: 'Media',
    entiteId: media.id,
    apres: { chemin },
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

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'reordonner_media',
    entite: 'Media',
    entiteId: mediaId,
    avant: { position: avant.position },
    apres: { position: apres.position },
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

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'modifier_alt_media',
    entite: 'Media',
    entiteId: mediaId,
    avant: { alt: avant.alt },
    apres: { alt },
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

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'definir_photo_principale',
    entite: 'Media',
    entiteId: mediaId,
    avant: { isPrimary: media.isPrimary },
    apres: { isPrimary: true },
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
  await effacerFichiersMedia(media.chemin)

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

  await enregistrerAudit({
    acteur: session.user.email,
    action: 'supprimer_media',
    entite: 'Media',
    entiteId: mediaId,
    avant: { chemin: media.chemin, alt: media.alt, isPrimary: media.isPrimary },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${media.productId}`)

  return { erreur: null }
}
