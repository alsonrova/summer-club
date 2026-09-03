import type { Route } from 'next'
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
      {/* `typedRoutes` (next.config.ts) exige `as Route` pour un href construit
          dynamiquement — la route /boutique/[slug] n'existe d'ailleurs pas encore
          (tâche 14), donc même un href littéral y échapperait aussi. Documenté dans
          node_modules/next/dist/docs/.../02-typescript.md, § « Statically Typed
          Links ». */}
      <Link href={`/boutique/${product.slug}` as Route} className="block">
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
          <span className="text-taupe">Rupture</span>
        )}
      </p>
    </article>
  )
}
