import type { Metadata } from 'next'
import { listProducts } from '@/server/products'
import { ProductCard } from '@/components/product/product-card'

// Rendu statique revalidé toutes les cinq minutes (spec § 4.3), et à la demande par les
// actions du back-office qui appellent revalidatePath('/boutique').
export const revalidate = 300

export const metadata: Metadata = {
  title: 'La boutique — Summer Club',
  description: "Colliers, bracelets, bagues et boucles d'oreilles en acier inoxydable plaqué or 18k.",
}

export default async function CatalogPage() {
  const products = await listProducts()

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
      <h1 className="text-h1 leading-[1.08]">La boutique</h1>
      {products.length === 0 ? (
        <p className="mt-10 text-bark-soft">Aucune pièce en boutique pour le moment.</p>
      ) : (
        <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-4 md:gap-x-8">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      )}
    </main>
  )
}
