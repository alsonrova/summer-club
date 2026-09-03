import type { ProductDetail } from '@/server/products'

// Données structurées schema.org d'une fiche (critère d'acceptation n°8 de la spec),
// sérialisées pour être injectées telles quelles dans <script type="application/ld+json">.
//
// JSON.stringify ne protège pas contre une fermeture de balise : une description qui
// contiendrait « </script> » — collée depuis ailleurs dans le back-office — terminerait
// le bloc et ce qui suit s'exécuterait comme du script. Chaque « < » est donc remplacé par
// sa séquence d'échappement JSON `\u003c`, ce qui laisse la valeur strictement identique
// une fois relue (c'est la parade documentée par Next.js lui-même :
// node_modules/next/dist/docs/01-app/02-guides/json-ld.md).
export function productJsonLd(product: ProductDetail): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.metaDescription,
    image: product.image,
    offers: {
      '@type': 'Offer',
      // Entier d'Ariary, jamais formaté ni converti (docs/CONVENTIONS.md § 5).
      price: product.finalPrice,
      priceCurrency: 'MGA',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
