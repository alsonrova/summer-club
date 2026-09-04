import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VariantPicker } from '@/components/product/variant-picker'
import type { ProductDetail } from '@/server/products'

// Fiche type : une déclinaison disponible sans promotion, une épuisée dont le prix est
// remisé (initialPrice > price), pour voir le prix barré changer avec la sélection.
const product: ProductDetail = {
  slug: 'collier-test',
  name: 'Collier test',
  finalPrice: 45000,
  initialPrice: 45000,
  image: '/placeholder-1200.avif',
  secondaryImage: null,
  inStock: true,
  description: 'Collier de test.',
  metaTitle: 'Collier test — Summer Club',
  metaDescription: 'Collier de test.',
  images: [{ path: '/placeholder-1200.avif', alt: 'Collier test' }],
  variants: [
    { id: 'v40', label: '40 cm', price: 45000, initialPrice: 45000, available: true },
    { id: 'v45', label: '45 cm', price: 48000, initialPrice: 50000, available: false },
  ],
}

// Comparaison du texte brut du DOM, espace insécable comprise — même raison que
// tests/components/product-card.test.tsx.
const rawText = { normalizer: (text: string) => text }

describe('VariantPicker', () => {
  it('propose les déclinaisons dans un groupe « Déclinaison » et coche la première disponible', () => {
    render(<VariantPicker product={product} />)
    expect(screen.getByRole('group', { name: 'Déclinaison' })).toBeDefined()
    expect((screen.getByRole('radio', { name: '40 cm' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('radio', { name: /45 cm/ }) as HTMLInputElement).checked).toBe(false)
  })

  it('coche la première déclinaison DISPONIBLE, pas la première tout court', () => {
    const reversed = { ...product, variants: [product.variants[1]!, product.variants[0]!] }
    render(<VariantPicker product={reversed} />)
    expect((screen.getByRole('radio', { name: '40 cm' }) as HTMLInputElement).checked).toBe(true)
  })

  it('affiche le prix de la déclinaison choisie, barré quand elle est remisée', () => {
    render(<VariantPicker product={product} />)
    expect(screen.getByText('45\u00A0000\u00A0Ar', rawText)).toBeDefined()
    expect(screen.queryByText('50\u00A0000\u00A0Ar', rawText)).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: /45 cm/ }))

    expect(screen.getByText('48\u00A0000\u00A0Ar', rawText)).toBeDefined()
    expect(screen.getByText('50\u00A0000\u00A0Ar', rawText).tagName.toLowerCase()).toBe('s')
  })

  it("signale la rupture en texte et ne rend jamais de bouton d'ajout au panier", () => {
    render(<VariantPicker product={product} />)
    // Déclinaison disponible : pas de message de rupture… et pas de bouton non plus, le
    // panier n'existant pas encore (tâche 16) — un bouton sans effet serait un défaut.
    expect(screen.queryByText('Rupture — cette pièce revient bientôt.')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: /45 cm/ }))

    expect(screen.getByText('Rupture — cette pièce revient bientôt.')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('sans déclinaison, affiche le prix du produit et la rupture', () => {
    // Le composant ne reçoit que déclinaisons et prix (VariantPickerProduct) : la rupture
    // se déduit de l'absence de déclinaison disponible, pas d'un `inStock` qu'il ne lit pas.
    render(<VariantPicker product={{ ...product, variants: [] }} />)
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.getByText('45\u00A0000\u00A0Ar', rawText)).toBeDefined()
    expect(screen.getByText('Rupture — cette pièce revient bientôt.')).toBeDefined()
  })
})
