import { describe, it, expect } from 'vitest'
import { productJsonLd } from '@/app/(storefront)/boutique/[slug]/structured-data'
import type { ProductDetail } from '@/server/products'

const product: ProductDetail = {
  slug: 'collier-test',
  name: 'Collier test',
  finalPrice: 40500,
  initialPrice: 45000,
  image: '/uploads/test-1200.avif',
  secondaryImage: null,
  inStock: true,
  description: 'Collier de test.',
  metaTitle: 'Collier test — Summer Club',
  metaDescription: 'Collier en acier inoxydable plaqué or 18k.',
  images: [{ path: '/uploads/test-1200.avif', alt: 'Collier test' }],
  variants: [{ id: 'v1', label: '45 cm', price: 40500, initialPrice: 45000, available: true }],
}

describe('productJsonLd', () => {
  it("décrit un produit schema.org avec son offre en Ariary, entière, et sa disponibilité", () => {
    const data = JSON.parse(productJsonLd(product))
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Collier test',
      description: 'Collier en acier inoxydable plaqué or 18k.',
      image: '/uploads/test-1200.avif',
      offers: {
        '@type': 'Offer',
        price: 40500,
        priceCurrency: 'MGA',
        availability: 'https://schema.org/InStock',
      },
    })
    // Le prix est un entier d'Ariary (docs/CONVENTIONS.md § 5), pas une chaîne formatée.
    expect(typeof data.offers.price).toBe('number')
  })

  it('déclare la rupture quand le produit est épuisé', () => {
    const data = JSON.parse(productJsonLd({ ...product, inStock: false }))
    expect(data.offers.availability).toBe('https://schema.org/OutOfStock')
  })

  it("ne laisse jamais une balise fermer le script, même si la description en contient une", () => {
    // Le contenu vient du back-office : une description collée depuis ailleurs peut porter
    // du HTML. Injecté tel quel dans <script type="application/ld+json">, « </script> »
    // terminerait le bloc et ce qui suit serait exécuté comme du script.
    const hostile = 'Très joli </script><script>alert(1)</script> collier'
    const serialized = productJsonLd({ ...product, metaDescription: hostile, name: '<b>Nom</b>' })

    expect(serialized.toLowerCase()).not.toContain('</script')
    expect(serialized).not.toContain('<')
    // …tout en restant du JSON strictement équivalent une fois relu.
    const data = JSON.parse(serialized)
    expect(data.description).toBe(hostile)
    expect(data.name).toBe('<b>Nom</b>')
  })
})
