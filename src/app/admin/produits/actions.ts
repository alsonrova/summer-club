'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/server/db'
import { requireAdmin } from '@/server/auth'
import { enregistrerAudit } from '@/server/audit'
import { traiterImage, validerFichierMedia } from '@/server/media'
import { validerFormData, formDataVersObjet } from '@/admin/engine/actions'
import { productsResource } from '@/admin/resources/products'
import type { EtatFormulaireProduit, EtatActionSimple } from './etats'

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

  const produit = await prisma.product.create({ data: resultat.donnees })
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

  const avant = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
  await prisma.product.update({ where: { id: productId }, data: resultat.donnees })
  await enregistrerAudit({
    acteur: session.user.email,
    action: 'modifier',
    entite: 'produits',
    entiteId: productId,
    avant,
    apres: resultat.donnees,
  })

  revalidatePath('/boutique')
  revalidatePath(`/admin/produits/${productId}`)

  return { succes: true, erreurs: {}, valeursInitiales: resultat.donnees }
}

export async function ajusterStock(
  variantId: string,
  _etatPrecedent: EtatActionSimple,
  formData: FormData,
): Promise<EtatActionSimple> {
  const session = await requireAdmin()

  const brut = formData.get('stock')
  const nouveauStock = Number(brut)
  if (brut === null || brut === '' || !Number.isInteger(nouveauStock) || nouveauStock < 0) {
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
  const { chemin } = await traiterImage(buffer, productId)

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
  if (brut === null || brut === '' || !Number.isInteger(nouvellePosition) || nouvellePosition < 0) {
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
