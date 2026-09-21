import Link from 'next/link'
import { ProductCard, type StorefrontProduct } from '@/components/product/product-card'
import { Reveal } from '@/components/ui/reveal'

// Sélection de produits mis en avant (spec § 8.3), dans la même grille que le catalogue :
// une seule mise en page de carte à maintenir, et la cliente retrouve en boutique ce
// qu'elle a vu ici.
//
// La section s'efface entièrement quand la boutique est vide. Un titre « Notre sélection »
// suivi d'une grille vide annonce un manque ; mieux vaut que la page enchaîne sur les avis
// — même parti pris que Reviews. Le catalogue, lui, garde son titre et affiche son état
// vide en toutes lettres : c'est la page qu'on a demandée, on lui doit une réponse.
export function Selection({ products }: { products: StorefrontProduct[] }) {
  if (products.length === 0) return null

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
      <Reveal>
        <h2 className="text-h2">Notre sélection</h2>
      </Reveal>
      <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-4 md:gap-x-8">
        {products.map((product, index) => (
          // Le décalage se remet à zéro à chaque rangée (quatre cartes en bureau, deux en
          // mobile) : sans cela, la huitième carte attendrait un demi-millier de
          // millisecondes après la première, ce qui se lit comme une lenteur.
          <Reveal key={product.slug} delay={(index % 4) * 70}>
            <ProductCard product={product} />
          </Reveal>
        ))}
      </div>
      <Reveal>
        <Link
          href="/boutique"
          className="mt-14 inline-block text-bark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
        >
          Voir toute la boutique
        </Link>
      </Reveal>
    </section>
  )
}
