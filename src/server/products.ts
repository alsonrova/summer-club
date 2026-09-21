import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { deleteMediaFiles } from '@/server/media'
import { resolvePrice } from '@/domain/pricing'
import { isSlug } from '@/domain/slug'
import type { PromotionRule } from '@/domain/types'
import type { StorefrontProduct } from '@/components/product/product-card'

// Cible d'invalidation pour revalidatePath (next/cache) : un chemin littéral, ou un
// gabarit de route dynamique accompagné du type de ce qu'il désigne. Le type n'est pas
// décoratif : revalidatePath('/boutique/[slug]') sans lui n'invalide RIEN — Next.js se
// contente d'un avertissement en console (node_modules/next/dist/server/web/
// spec-extension/revalidate.js, `isDynamicRoute` sans `type`). Un tuple se passe tel quel
// à l'appel : `revalidatePath(...target)` — d'où l'élément optionnel plutôt qu'une union
// de tuples, que TypeScript refuse d'étaler en arguments.
export type RevalidationTarget = [path: string, type?: 'page' | 'layout']

// Chemins publics dont le rendu dépend d'un produit : l'accueil, le catalogue et chaque
// fiche. Même motif que pathsToRevalidate (src/server/order-status-service.ts) : ce module
// ne peut pas invalider lui-même (revalidatePath exige un contexte de requête, absent sous
// Vitest et dans un script), il publie donc la liste pour qu'aucun appelant n'ait à deviner
// ni à oublier. Sans la fiche, un lien /boutique/<slug> déjà partagé continuait de servir depuis
// le cache ISR (revalidate = 300) un produit retiré, un stock parti ou un prix changé —
// jusqu'à cinq minutes ; et un 404 mis en cache avant la création du produit survivait à
// sa création (constat de la revue de la tâche 14).
//
// Le gabarit de la fiche plutôt que le chemin exact du produit, à dessein : un changement
// de slug doit rendre l'ancienne adresse introuvable autant que la nouvelle visible, et les
// actions sur une déclinaison ou une photo ne connaissent que l'identifiant du produit. Le
// coût — chaque fiche re-rendue à sa prochaine visite — est celui d'un catalogue de
// quelques dizaines de pièces.
//
// L'accueil est entré dans cette liste à la tâche 15, avec sa section « Notre sélection »
// qui lit listProducts : rendu statiquement lui aussi (revalidate = 300), il aurait gardé
// jusqu'à cinq minutes un produit désactivé, renommé ou remisé — le jumeau exact du défaut
// trouvé sur la fiche à la revue de la tâche 14 (docs/CONVENTIONS.md § 4, règle 3 : après
// un cas corrigé, chercher son symétrique). C'est un chemin littéral, sans `type` : `/`
// est une adresse, pas un gabarit.
//
// Le gabarit s'écrit AVEC le groupe de routes, `/(storefront)/boutique/[slug]`, et pas
// `/boutique/[slug]` comme l'URL : avec `type`, revalidatePath désigne un fichier de
// route, non une adresse (node_modules/next/dist/docs/01-app/03-api-reference/
// 04-functions/revalidatePath.md, « or with route groups »). Mesuré sur le serveur de
// production : l'entrée de cache d'une fiche porte le tag
// `_N_T_/(storefront)/boutique/[slug]/page` (fichier .meta, en-tête x-next-cache-tags), et
// `/boutique/[slug]` ne l'atteignait pas — le 404 mis en cache survivait à la création du
// produit, le bout-en-bout l'a montré avant ce correctif. Le chemin littéral `/boutique`,
// lui, est bien une adresse : l'entrée du catalogue porte le tag `_N_T_/boutique`.
export function productPathsToRevalidate(): RevalidationTarget[] {
  return [['/'], ['/boutique'], ['/(storefront)/boutique/[slug]', 'page']]
}

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

// Longueur usuelle d'une meta description avant que les moteurs ne la tronquent eux-mêmes.
const META_DESCRIPTION_MAX_LENGTH = 155

// Meta description de repli, dérivée de la description : coupée sur la dernière espace
// avant la limite pour ne jamais laisser un demi-mot, et jamais un demi-caractère non plus
// — `slice` compte en unités UTF-16, un emoji à la frontière laisserait une moitié de
// paire de substitution dans la meta et dans le JSON-LD qui la reprend. Les points de
// suspension disent que la phrase continue sur la fiche.
function metaDescriptionFrom(description: string): string {
  if (description.length <= META_DESCRIPTION_MAX_LENGTH) return description
  // Un caractère de moins que la limite : la place des points de suspension.
  const head = description.slice(0, META_DESCRIPTION_MAX_LENGTH - 1)
  const lastSpace = head.lastIndexOf(' ')
  // Sans espace (un seul mot interminable), la coupe tombe sur la limite : seule la fin
  // peut alors être une moitié de caractère, puisque la description relue de PostgreSQL
  // est bien formée.
  const cut = lastSpace > 0 ? head.slice(0, lastSpace) : head
  const wellFormed = cut.isWellFormed() ? cut : cut.slice(0, -1)
  return `${wellFormed}…`
}

// Ordre des photos : la position choisie au back-office, puis l'identifiant pour départager
// deux photos de même position — sans ce second critère, la photo principale d'une carte ou
// d'une fiche dépendrait du plan d'exécution (même raisonnement que `name` pour les
// produits, plus bas).
const MEDIA_ORDER: Prisma.MediaOrderByWithRelationInput[] = [{ position: 'asc' }, { id: 'asc' }]

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
      media: { orderBy: MEDIA_ORDER, take: 2, select: { path: true } },
    },
    // `name` départage deux produits de même ordre : sans ce second critère, l'ordre du
    // catalogue dépendrait du plan d'exécution et pourrait changer d'un rendu à l'autre.
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })

  const promotions = await activePromotions()
  const now = new Date()
  return products.map((product) => toStorefrontProduct(product, promotions, now, CATALOG_WIDTH))
}

// Slugs des produits actifs, et rien d'autre : ce que generateStaticParams
// (src/app/(storefront)/boutique/[slug]/page.tsx) a besoin de connaître au build. Passer
// par listProducts chargeait les promotions, calculait les prix effectifs et projetait les
// photos de chaque produit pour n'en garder que le slug.
export async function listActiveProductSlugs(): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { slug: true },
    orderBy: { slug: 'asc' },
  })
  return products.map((product) => product.slug)
}

export async function loadProduct(slug: string): Promise<ProductDetail | null> {
  // Liste blanche AVANT la requête : le slug vient de l'URL, donc de n'importe qui. Une
  // valeur que le back-office n'aurait jamais acceptée ne peut pas exister en base — elle
  // ne vaut pas une requête, et un NUL ferait lever PostgreSQL (500 au lieu de 404). Refuser,
  // pas réparer (docs/CONVENTIONS.md § 4, règle 5). Ce garde ne borne pas le cache ISR :
  // un slug bien formé mais inconnu est toujours rendu puis mis en cache (voir la
  // passation, dette « cache ISR des fiches inconnues », tâche 22).
  if (!isSlug(slug)) return null

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: { orderBy: { label: 'asc' } },
      media: { orderBy: MEDIA_ORDER },
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
    metaDescription: product.metaDescription || metaDescriptionFrom(product.description),
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
