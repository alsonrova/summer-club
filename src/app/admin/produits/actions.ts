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
import { isUniqueViolation } from '@/server/prisma-errors'
import { validateFormData, formDataToObject } from '@/admin/engine/actions'
import { productsResource } from '@/admin/resources/products'
import { variantsResource } from '@/admin/resources/variants'
import type {
  ProductFormState,
  VariantFormState,
  SimpleActionState,
} from './states'

// Convention d'administration (voir src/server/auth.ts) : un layout ne protège ni les
// Server Actions ni les Route Handlers — chaque action ici appelle requireAdmin() elle-même,
// même si les briques du moteur qu'elle invoque (validateFormData, recordAudit) le font
// déjà indirectement pour certaines. La lecture de session est mise en cache par requête
// (React cache()), ce doublon ne coûte donc rien.

// Next.js 16 (voir node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md,
// section « Handling expected errors ») : les erreurs de validation attendues (un prix
// négatif, un stock invalide, un fichier refusé) doivent être modélisées comme des valeurs
// de retour consommées par useActionState côté client, pas levées avec throw — lever ne
// convient qu'aux erreurs réellement inattendues (ex. findUniqueOrThrow sur un id forgé).
//
// ProductFormState/SimpleActionState (et leurs valeurs initiales) vivent dans ./states.ts,
// pas ici : un fichier 'use server' ne peut exporter que des fonctions async (voir
// https://nextjs.org/docs/messages/invalid-use-server-value).

// Borne haute d'un entier PostgreSQL (colonnes `Int`) : les champs validés directement ici
// (pas via un schéma Zod — `adjustStock`/`reorderMedia` analysent `FormData` à la main)
// doivent la respecter tout autant que ceux de productSchema/variantSchema, sous peine de
// laisser passer une valeur que Prisma refuserait avec une erreur non gérée.
const POSTGRES_INT_MAX = 2147483647

export async function createProduct(
  _previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireAdmin()
  const result = validateFormData(productsResource, formData)

  if (!result.success) {
    return {
      success: false,
      errors: result.errors,
      initialValues: formDataToObject(formData, productsResource),
    }
  }

  let product
  try {
    product = await prisma.product.create({ data: result.data })
  } catch (error) {
    if (isUniqueViolation(error, 'slug')) {
      return {
        success: false,
        errors: { slug: ['Ce slug est déjà utilisé par un autre produit.'] },
        initialValues: formDataToObject(formData, productsResource),
      }
    }
    throw error
  }

  await recordAudit({
    actor: session.user.email,
    action: 'create',
    entity: 'products',
    entityId: product.id,
    after: result.data,
  })

  // Le catalogue public lit ces mêmes produits : sans cette invalidation, une création
  // resterait invisible en boutique jusqu'à l'expiration naturelle du cache.
  revalidatePath('/boutique')
  revalidatePath('/admin/produits')
  redirect(`/admin/produits/${product.id}`)
}

export async function updateProduct(
  productId: string,
  _previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireAdmin()
  const result = validateFormData(productsResource, formData)

  if (!result.success) {
    return {
      success: false,
      errors: result.errors,
      initialValues: formDataToObject(formData, productsResource),
    }
  }

  const fullBefore = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
  // Restreint aux mêmes clés que `result.data` (les champs réellement modifiés) :
  // sans ce filtrage, `before` porterait aussi des dates et des colonnes absentes du
  // formulaire, rendant `before`/`after` non comparables champ à champ dans le journal
  // d'audit — alors que c'est précisément sa raison d'être.
  const beforeSameKeys = Object.fromEntries(
    Object.keys(result.data).map((key) => [
      key,
      (fullBefore as Record<string, unknown>)[key],
    ]),
  )

  try {
    await prisma.product.update({ where: { id: productId }, data: result.data })
  } catch (error) {
    if (isUniqueViolation(error, 'slug')) {
      return {
        success: false,
        errors: { slug: ['Ce slug est déjà utilisé par un autre produit.'] },
        initialValues: formDataToObject(formData, productsResource),
      }
    }
    throw error
  }

  await recordAudit({
    actor: session.user.email,
    action: 'update',
    entity: 'products',
    entityId: productId,
    before: beforeSameKeys,
    after: result.data,
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${productId}`)

  return { success: true, errors: {}, initialValues: result.data }
}

export async function createVariant(
  productId: string,
  _previousState: VariantFormState,
  formData: FormData,
): Promise<VariantFormState> {
  const session = await requireAdmin()
  const result = validateFormData(variantsResource, formData)

  if (!result.success) {
    return {
      success: false,
      errors: result.errors,
      initialValues: formDataToObject(formData, variantsResource),
    }
  }

  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
  const resultingPrice = product.basePrice + result.data.priceDelta
  if (resultingPrice <= 0) {
    return {
      success: false,
      errors: {
        priceDelta: ['Le prix de vente résultant (prix de base + écart) doit être positif.'],
      },
      initialValues: formDataToObject(formData, variantsResource),
    }
  }

  let variant
  try {
    variant = await prisma.variant.create({ data: { productId, ...result.data } })
  } catch (error) {
    // Deux contraintes d'unicité distinctes sur Variant (voir prisma/schema.prisma) :
    // `sku` (globale) et `(productId, label)` (par produit). Sans les distinguer,
    // la propriétaire verrait une erreur technique au premier doublon.
    if (isUniqueViolation(error, 'sku')) {
      return {
        success: false,
        errors: { sku: ['Ce SKU est déjà utilisé par une autre déclinaison.'] },
        initialValues: formDataToObject(formData, variantsResource),
      }
    }
    if (isUniqueViolation(error, 'label')) {
      return {
        success: false,
        errors: { label: ['Une déclinaison avec ce libellé existe déjà pour ce produit.'] },
        initialValues: formDataToObject(formData, variantsResource),
      }
    }
    throw error
  }

  await recordAudit({
    actor: session.user.email,
    action: 'create',
    entity: 'Variant',
    entityId: variant.id,
    after: result.data,
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${productId}`)

  return { success: true, errors: {}, initialValues: {} }
}

export async function adjustStock(
  variantId: string,
  _previousState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const session = await requireAdmin()

  const raw = formData.get('stock')
  const newStock = Number(raw)
  if (
    raw === null ||
    raw === '' ||
    !Number.isInteger(newStock) ||
    newStock < 0 ||
    newStock > POSTGRES_INT_MAX
  ) {
    return { error: 'Le stock doit être un entier positif ou nul.' }
  }

  const before = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
  const after = await prisma.variant.update({
    where: { id: variantId },
    data: { stock: newStock },
  })

  // Seule trace qui permettra plus tard de comprendre un écart d'inventaire : l'ancienne
  // ET la nouvelle valeur, jamais l'une sans l'autre.
  await recordAudit({
    actor: session.user.email,
    action: 'adjust_stock',
    entity: 'Variant',
    entityId: variantId,
    before: { stock: before.stock },
    after: { stock: after.stock },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${before.productId}`)

  return { error: null }
}

export async function uploadMedia(
  productId: string,
  _previousState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const session = await requireAdmin()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Aucun fichier sélectionné.' }
  }

  const validationError = validateMediaFile(file)
  if (validationError) {
    return { error: validationError }
  }

  // Nom du produit lu avant tout traitement : il sert de texte alternatif de départ (voir
  // plus bas). Sur un productId inexistant, findUniqueOrThrow ne retourne pas une erreur —
  // elle LÈVE (Prisma P2025), et l'action s'interrompt sans être rattrapée. Ce n'est pas une
  // entorse à la conception « erreurs retournées, pas levées » de ce fichier : celle-ci vise
  // les fautes de saisie que la propriétaire peut corriger, pas un identifiant absent de
  // l'interface, donc forgé. L'intérêt de placer cette lecture ici est de sortir avant
  // d'écrire six fichiers que plus aucune ligne ne référencerait.
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { name: true },
  })

  const buffer = Buffer.from(await file.arrayBuffer())
  // processImage assainit le nom et y ajoute elle-même un suffixe aléatoire d'unicité :
  // inutile d'horodater ici, et surtout ne jamais lui passer le nom envoyé par le
  // navigateur (file.name) — seul l'identifiant du produit, déjà validé, lui est confié.
  //
  // Un fichier au type MIME usurpé (un PDF renommé en .jpg, une image tronquée, un format
  // que sharp refuse malgré un en-tête accepté par validateMediaFile) fait lever
  // processImage : conformément à la conception « erreurs retournées, pas levées » de ce
  // fichier, on l'attrape ici plutôt que de laisser l'action entière planter avec une
  // trace technique.
  let imagePath: string
  try {
    ;({ path: imagePath } = await processImage(buffer, productId))
  } catch (error) {
    // Journalisé dans tous les cas, avec l'erreur réelle : sans cette trace, un disque
    // plein ou des droits refusés sur public/uploads seraient indiscernables côté serveur
    // d'un fichier corrompu, donc indiagnosticables.
    console.error('[uploadMedia] échec du traitement de l’image', { productId, error })

    // Seul le vrai échec de décodage (UnreadableImageError, levée par le seul encodage —
    // voir src/server/media.ts) mérite d'être imputé au fichier envoyé.
    if (error instanceof UnreadableImageError) {
      return {
        error:
          "Cette image n'a pas pu être lue. Vérifiez qu'il s'agit bien d'une photo JPEG, PNG, WebP ou AVIF.",
      }
    }
    // Tout le reste (écriture disque impossible, dossier inaccessible) est une panne du
    // serveur : le dire, plutôt que de laisser croire que la photo est en cause.
    return {
      error:
        "Le téléversement a échoué pour une raison technique. Réessayez ; si le problème persiste, prévenez votre développeur.",
    }
  }

  const count = await prisma.media.count({ where: { productId } })
  const media = await prisma.media.create({
    data: {
      productId,
      path: imagePath,
      // Texte alternatif de départ dérivé du nom du produit, jamais la chaîne vide :
      // updateMediaAlt refuse un alt vide, une photo fraîchement téléversée se
      // retrouvait donc dans un état que l'éditeur interdit de reproduire, et partait en
      // vitrine sans texte alternatif (accessibilité, référencement). Rendre le champ
      // obligatoire au téléversement aurait été l'autre option : écartée parce qu'elle
      // impose une saisie au milieu du geste courant « j'ajoute mes cinq photos, je les
      // décris ensuite », alors qu'une valeur de départ correcte — et toujours
      // modifiable — garantit le même invariant sans friction. Le nom seul, sans préfixe
      // « Photo de » : l'élément <img> annonce déjà qu'il s'agit d'une image, le répéter
      // dans l'alt est une redondance que les lecteurs d'écran font entendre deux fois.
      alt: product.name,
      position: count,
      isPrimary: count === 0,
    },
  })

  await recordAudit({
    actor: session.user.email,
    action: 'add_media',
    entity: 'Media',
    entityId: media.id,
    after: { path: imagePath },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${productId}`)

  return { error: null }
}

// Pas de glisser-déposer (écran hors périmètre de cette tâche, voir le plan) : un simple
// ordre numérique suffit pour réordonner les photos d'un produit.
export async function reorderMedia(
  mediaId: string,
  _previousState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const session = await requireAdmin()

  const raw = formData.get('position')
  const newPosition = Number(raw)
  if (
    raw === null ||
    raw === '' ||
    !Number.isInteger(newPosition) ||
    newPosition < 0 ||
    newPosition > POSTGRES_INT_MAX
  ) {
    return { error: 'La position doit être un entier positif ou nul.' }
  }

  const before = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } })
  const after = await prisma.media.update({
    where: { id: mediaId },
    data: { position: newPosition },
  })

  await recordAudit({
    actor: session.user.email,
    action: 'reorder_media',
    entity: 'Media',
    entityId: mediaId,
    before: { position: before.position },
    after: { position: after.position },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${before.productId}`)

  return { error: null }
}

export async function updateMediaAlt(
  mediaId: string,
  _previousState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const session = await requireAdmin()

  const raw = formData.get('alt')
  const alt = typeof raw === 'string' ? raw.trim() : ''
  if (alt === '') {
    return { error: 'Le texte alternatif est requis.' }
  }

  const before = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } })
  await prisma.media.update({ where: { id: mediaId }, data: { alt } })

  await recordAudit({
    actor: session.user.email,
    action: 'update_media_alt',
    entity: 'Media',
    entityId: mediaId,
    before: { alt: before.alt },
    after: { alt },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${before.productId}`)

  return { error: null }
}

export async function setPrimaryPhoto(
  mediaId: string,
  _previousState: SimpleActionState,
  _formData: FormData,
): Promise<SimpleActionState> {
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
    action: 'set_primary_photo',
    entity: 'Media',
    entityId: mediaId,
    before: { isPrimary: media.isPrimary },
    after: { isPrimary: true },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${media.productId}`)

  return { error: null }
}

export async function deleteMedia(
  mediaId: string,
  _previousState: SimpleActionState,
  _formData: FormData,
): Promise<SimpleActionState> {
  const session = await requireAdmin()

  const media = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } })

  // Efface les fichiers avant la ligne en base : si l'effacement disque échouait, mieux
  // vaut une ligne orpheline (photo cassée, visible, corrigible) qu'un fichier orphelin
  // sur disque qu'aucune fiche ne référence plus jamais.
  await deleteMediaFiles(media.path)

  await prisma.$transaction(async (tx) => {
    await tx.media.delete({ where: { id: mediaId } })

    // Un produit qui a des photos en a exactement une principale : si celle qu'on vient
    // de supprimer l'était, la suivante (par position) prend le relais.
    if (media.isPrimary) {
      const next = await tx.media.findFirst({
        where: { productId: media.productId },
        orderBy: { position: 'asc' },
      })
      if (next) {
        await tx.media.update({ where: { id: next.id }, data: { isPrimary: true } })
      }
    }
  })

  await recordAudit({
    actor: session.user.email,
    action: 'delete_media',
    entity: 'Media',
    entityId: mediaId,
    before: { path: media.path, alt: media.alt, isPrimary: media.isPrimary },
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${media.productId}`)

  return { error: null }
}
