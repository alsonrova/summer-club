import { prisma } from '@/server/db'
import { deleteMediaFiles } from '@/server/media'
import { resolvePrice } from '@/domain/pricing'
import type { PromotionRule } from '@/domain/types'
import type { StorefrontProduct } from '@/components/product/product-card'

export type ProductDetail = StorefrontProduct & {
  description: string
  metaTitle: string
  metaDescription: string
  images: { path: string; alt: string }[]
  // `price` est le prix effectif de la déclinaison et `initialPrice` son prix avant
  // remise : Price (src/components/ui/price.tsx) barre le second quand il dépasse le
  // premier. Un `initialPrice` pris au niveau du produit barrerait à tort une déclinaison
  // dont le seul écart vient de priceDelta.
  variants: { id: string; label: string; price: number; initialPrice: number; available: boolean }[]
}

// Largeurs produites par processImage (src/server/media.ts) : 800 px pour une carte du
// catalogue, affichée au mieux sur une demi-largeur d'écran ; 1200 px pour la galerie
// d'une fiche. Les images de repli portent les mêmes largeurs (public/placeholder-*.avif).
const CATALOG_WIDTH = 800
const DETAIL_WIDTH = 1200

function imageFile(mediaPath: string, width: number): string {
  return `${mediaPath}-${width}.avif`
}

function placeholder(width: number): string {
  return `/placeholder-${width}.avif`
}

async function activePromotions(): Promise<PromotionRule[]> {
  return prisma.promotion.findMany({ where: { active: true } })
}

// Sous-ensemble des colonnes dont la projection vitrine a besoin, indépendant de la forme
// exacte des deux requêtes ci-dessous (l'une ne charge que le stock des déclinaisons et
// deux photos, l'autre tout).
type ProductRow = {
  id: string
  slug: string
  name: string
  basePrice: number
  categoryId: string
  variants: { stock: number }[]
  media: { path: string }[]
}

// Prix public : la boutique ne connaît pas encore de session cliente, donc jamais de tarif
// membre ici. `now` vient de l'appelant serveur, jamais du domaine (docs/CONVENTIONS.md § 2).
function toStorefrontProduct(
  product: ProductRow, promotions: PromotionRule[], now: Date, width: number,
): StorefrontProduct {
  const { initialPrice, finalPrice } = resolvePrice({
    basePrice: product.basePrice, productId: product.id, categoryId: product.categoryId,
    promotions, now, isMember: false,
  })
  const [first, second] = product.media
  return {
    slug: product.slug,
    name: product.name,
    initialPrice,
    finalPrice,
    image: first ? imageFile(first.path, width) : placeholder(width),
    secondaryImage: second ? imageFile(second.path, width) : null,
    inStock: product.variants.some((variant) => variant.stock > 0),
  }
}

export async function listProducts(categorySlug?: string): Promise<StorefrontProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: {
      variants: { select: { stock: true } },
      // La carte n'affiche que la photo principale et celle du survol.
      media: { orderBy: { position: 'asc' }, take: 2, select: { path: true } },
    },
    // `name` départage deux produits de même ordre : sans ce second critère, l'ordre du
    // catalogue dépendrait du plan d'exécution et pourrait changer d'un rendu à l'autre.
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })

  const promotions = await activePromotions()
  const now = new Date()
  return products.map((product) => toStorefrontProduct(product, promotions, now, CATALOG_WIDTH))
}

export async function loadProduct(slug: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: { orderBy: { label: 'asc' } },
      media: { orderBy: { position: 'asc' } },
    },
  })
  // Un produit désactivé disparaît de la boutique comme s'il n'avait jamais existé :
  // même réponse qu'un slug inconnu, pour ne rien révéler d'une fiche en coulisses.
  if (!product || !product.active) return null

  const promotions = await activePromotions()
  const now = new Date()

  const images = product.media.map((media) => ({
    path: imageFile(media.path, DETAIL_WIDTH),
    // Un texte alternatif vide n'a jamais sa place sur la photo principale d'une fiche.
    alt: media.alt || product.name,
  }))

  return {
    ...toStorefrontProduct(product, promotions, now, DETAIL_WIDTH),
    description: product.description,
    // `||` et non `??` : une chaîne vide n'est pas un titre.
    metaTitle: product.metaTitle || `${product.name} — Summer Club`,
    metaDescription: product.metaDescription || product.description.slice(0, 155),
    // Sans photo, la fiche garde sa galerie (image de repli) plutôt qu'un vide qui
    // déséquilibrerait la mise en page.
    images: images.length > 0 ? images : [{ path: placeholder(DETAIL_WIDTH), alt: product.name }],
    variants: product.variants.map((variant) => {
      // Même assiette que createOrder (src/server/orders.ts) : la promotion s'applique au
      // prix de base augmenté de l'écart. Remiser le prix du produit puis ajouter l'écart
      // donnerait, pour une remise en pourcentage, un prix affiché que la commande ne
      // facturerait pas.
      const { initialPrice, finalPrice } = resolvePrice({
        basePrice: product.basePrice + variant.priceDelta,
        productId: product.id, categoryId: product.categoryId,
        promotions, now, isMember: false,
      })
      return {
        id: variant.id,
        label: variant.label,
        price: finalPrice,
        initialPrice,
        available: variant.stock > 0,
      }
    }),
  }
}

// Fonction propriétaire de la suppression d'un produit. La cascade Prisma (Media, Variant)
// n'atteint que les lignes en base : les fichiers écrits par processImage dans
// public/uploads — un dossier servi publiquement — ne sont référencés par rien d'autre que
// Media.path, et un `product.delete` brut les abandonne sur disque, accessibles à qui
// connaît leur URL (dette constatée le 2026-08-30 : six fichiers orphelins). L'effacement
// disque appartient donc à cette fonction, pas à chaque appelant — même raisonnement que la
// liste blanche de processImage (docs/CONVENTIONS.md § 4, règle 5) : un futur appelant qui
// supprime un produit n'a aucune raison de connaître cette obligation, et c'est le seul
// endroit qu'il ne peut pas oublier.
//
// Comme applyStatus (src/server/order-status-service.ts), cette fonction est le cœur
// sans authentification ni invalidation de cache : une future Server Action de suppression
// appellera requireAdmin(), déléguera ici, puis auditera et revalidera elle-même.
export async function deleteProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, media: { select: { path: true } } },
  })
  // Tolère l'absence : deux passes de nettoyage (avant/après un test, double clic demain)
  // peuvent se croiser, et la seconde ne doit pas lever.
  if (!product) return

  // Fichiers d'abord, lignes ensuite — même ordre et même raisonnement que deleteMedia
  // (src/app/admin/produits/actions.ts) : si l'effacement disque échoue, mieux vaut un
  // produit intact aux photos cassées (visible, corrigible) que des fichiers orphelins
  // qu'aucune fiche ne référence plus jamais. deleteMediaFiles est idempotente
  // (rm force), un nouvel appel après échec partiel reprend sans broncher.
  await Promise.all(product.media.map((media) => deleteMediaFiles(media.path)))

  // deleteMany plutôt que delete : findUnique puis delete n'est pas atomique, et une
  // suppression concurrente entre les deux ne doit pas transformer « déjà supprimé » en
  // erreur P2025 (même choix que cleanUpTestProduct, e2e/admin-products.spec.ts).
  await prisma.product.deleteMany({ where: { id: product.id } })
}
