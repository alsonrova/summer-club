import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Hero } from '@/components/home/hero'
import { About } from '@/components/home/about'
import { Selection } from '@/components/home/selection'
import { CallToAction } from '@/components/home/call-to-action'
import type { StorefrontProduct } from '@/components/product/product-card'

// Ces sections sont rendues sous un jsdom nu, donc sans IntersectionObserver : Reveal
// montre alors son contenu sans attendre (tests/components/reveal.test.tsx). Les
// assertions ci-dessous portent donc sur ce qu'une visiteuse lit une fois la section
// entrée dans le champ.

function product(slug: string, name: string): StorefrontProduct {
  return {
    slug, name,
    finalPrice: 45000, initialPrice: 45000,
    image: '/placeholder-800.avif', secondaryImage: null, inStock: true,
  }
}

describe('Hero', () => {
  it("porte le seul h1 de la page et l'appel à l'action vers la boutique", () => {
    render(<Hero />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]?.textContent).toContain('Le bijou')
    expect(screen.getByRole('link', { name: 'La boutique' }).getAttribute('href')).toBe('/boutique')
  })
})

describe('About', () => {
  it('tient en trois arguments au plus, comme la spec le borne', () => {
    // Spec § 8.2 : « Deux à trois arguments, pas davantage ». Un quatrième argument
    // ajouté sans relire la spec fait rougir ce test — c'est son seul rôle.
    render(<About />)
    expect(screen.getByRole('heading', { name: 'Notre histoire' })).toBeDefined()
    expect(screen.getAllByRole('listitem').length).toBeLessThanOrEqual(3)
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
  })
})

describe('Selection', () => {
  it('rend une carte par produit mis en avant', () => {
    render(<Selection products={[product('collier-vahine', 'Collier Vahiné'), product('bague-sable', 'Bague Sable')]} />)
    expect(screen.getByRole('heading', { name: 'Notre sélection' })).toBeDefined()
    expect(screen.getByText('Collier Vahiné')).toBeDefined()
    expect(screen.getByText('Bague Sable')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Voir toute la boutique' }).getAttribute('href'))
      .toBe('/boutique')
  })

  it('disparaît entièrement quand aucun produit n\'est en boutique', () => {
    // Un titre « Notre sélection » suivi d'une grille vide est pire qu'une section absente :
    // il annonce un manque. Même parti pris que Reviews, et que l'état vide du catalogue.
    const { container } = render(<Selection products={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('CallToAction', () => {
  it('mène à la boutique et à Instagram', () => {
    render(<CallToAction />)
    const banner = screen.getByRole('region', { name: 'Rejoindre Summer Club' })
    expect(within(banner).getByRole('link', { name: 'La boutique' }).getAttribute('href'))
      .toBe('/boutique')
    expect(within(banner).getByRole('link', { name: 'Instagram' }).getAttribute('href'))
      .toBe('https://www.instagram.com/summerclub.mg')
  })

  it('affiche le lien WhatsApp quand le numéro est configuré', () => {
    render(<CallToAction whatsappNumber="261324618290" />)
    expect(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href'))
      .toBe('https://wa.me/261324618290')
  })

  it("n'affiche aucun lien WhatsApp tant que le numéro n'est pas configuré", () => {
    // Le numéro WhatsApp Business est une dépendance externe que la spec § 12 laisse
    // ouverte : il n'est pas dans le dépôt, et aucun numéro ne s'invente. Un lien mort est
    // un défaut, pas une promesse — même raisonnement que le lien « Panier » retiré de
    // l'en-tête jusqu'à la tâche 16.
    render(<CallToAction />)
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull()
  })

  it('refuse un numéro mal formé au lieu de le réparer', () => {
    // Liste blanche, pas nettoyage (§ 4, règle 5 des conventions) : une valeur
    // d'environnement approximative (« 032 46 182 90 », « +261 32… ») produirait une URL
    // wa.me silencieusement fausse. La normalisation d'un numéro malgache appartient à
    // whatsappLink (tâche 18) ; jusque-là, seule la forme internationale est acceptée.
    render(<CallToAction whatsappNumber="+261 32 46 182 90" />)
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull()
  })
})
