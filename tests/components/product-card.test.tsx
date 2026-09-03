import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductCard } from '@/components/product/product-card'

// Produit type utilisé par les quatre scénarios ci-dessous. `initialPrice` égal à
// `finalPrice` reproduit le cas « pas de promotion » : le prix barré ne doit alors
// jamais apparaître (voir Price, qui décide sur `initial > amount`, pas sur sa
// seule présence).
const product = {
  slug: 'collier-vahine',
  name: 'Collier Vahiné',
  finalPrice: 45000,
  initialPrice: 45000,
  image: '/uploads/x-800.avif',
  secondaryImage: null,
  inStock: true,
}

// Le normaliseur par défaut de testing-library réduit toute suite d'espaces —
// espace insécable compris, car `\s` en JavaScript le reconnaît comme espace —
// à un simple espace ASCII avant comparaison. Un test qui laisserait ce
// normaliseur agir sur les assertions de prix resterait vert même si
// `formatAriary` régressait vers un espace ordinaire : exactement le défaut que
// ce test doit détecter (§ 5.1 des conventions). On le désactive donc ici
// pour comparer le texte du DOM tel quel.
const rawText = { normalizer: (text: string) => text }

describe('ProductCard', () => {
  it('affiche le nom et le prix formaté', () => {
    render(<ProductCard product={product} />)
    expect(screen.getByText('Collier Vahiné')).toBeDefined()
    expect(screen.getByText('45\u00A0000\u00A0Ar', rawText)).toBeDefined()
  })

  it("affiche le prix barré quand une promotion s'applique", () => {
    render(<ProductCard product={{ ...product, finalPrice: 36000 }} />)
    expect(screen.getByText('36\u00A0000\u00A0Ar', rawText)).toBeDefined()
    const struckPrice = screen.getByText('45\u00A0000\u00A0Ar', rawText)
    expect(struckPrice.tagName.toLowerCase()).toBe('s')
  })

  it('indique la rupture par du texte, pas par un bouton désactivé', () => {
    render(<ProductCard product={{ ...product, inStock: false }} />)
    expect(screen.getByText('Rupture')).toBeDefined()
    // L'intention du brief (« pas de bouton désactivé ») se vérifie ici par l'absence
    // totale de bouton : la version installée de testing-library ne supporte pas
    // l'option `disabled` sur `getByRole` (vérifié dans node_modules, § 0 des
    // conventions), et un bouton désactivé serait de toute façon interdit par la
    // charte (§ 3.8 de la spec) : la rupture ne s'exprime qu'en texte.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('donne un texte alternatif décrivant le produit', () => {
    render(<ProductCard product={product} />)
    expect(screen.getByAltText(/Collier Vahiné/)).toBeDefined()
  })
})
