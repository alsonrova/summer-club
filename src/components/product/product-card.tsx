import Image from 'next/image'
import Link from 'next/link'
import { Price } from '@/components/ui/price'

export type StorefrontProduct = {
  slug: string
  name: string
  finalPrice: number
  initialPrice: number
  image: string
  secondaryImage: string | null
  inStock: boolean
}

// Un article en rupture n'affiche jamais un bouton grisé : la charte (spec § 3.8)
// impose une mention textuelle explicite. Il n'y a donc ici aucun bouton du tout, pas
// un bouton désactivé — la nuance compte pour l'accessibilité (un bouton désactivé ne
// donne aucune explication au toucher, et est proscrit).
export function ProductCard({ product }: { product: StorefrontProduct }) {
  return (
    <article className="group">
      {/* `typedRoutes` (next.config.ts) accepte ce gabarit sans cast : depuis la tâche 14,
          /boutique/[slug] existe sous src/app/ et `.next/types/routes.d.ts` (engendré au
          build) type le href comme `/boutique/${string}`. */}
      <Link href={`/boutique/${product.slug}`} className="block">
        <div
          className="relative aspect-[4/5] overflow-hidden bg-clay transition-transform duration-500 group-hover:scale-[1.015]"
          style={{ borderRadius: 'var(--radius-arch)' }}
        >
          <Image
            src={product.image}
            alt={`${product.name} — bijou en acier inoxydable plaqué or`}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-opacity duration-[400ms] group-hover:opacity-0"
          />
          {product.secondaryImage && (
            <Image
              src={product.secondaryImage}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover opacity-0 transition-opacity duration-[400ms] group-hover:opacity-100"
            />
          )}
        </div>
        <h3 className="mt-3.5 font-display text-[17px] font-normal">{product.name}</h3>
      </Link>
      <p className="mt-0.5 text-sm">
        {product.inStock ? (
          <Price amount={product.finalPrice} initial={product.initialPrice} />
        ) : (
          // Même couleur que le prix voisin et que le message de rupture de la fiche
          // (VariantPicker). En taupe, la mention mesurait 2,08:1 sur sable à 14 px
          // (testeur UX/UI, tâche 14), sous le seuil de 4,5:1 : le taupe borde et sépare,
          // il n'écrit pas (tests/tokens.test.ts) — et la disponibilité est une
          // information, pas un ornement.
          <span className="text-bark-soft">Rupture</span>
        )}
      </p>
    </article>
  )
}
