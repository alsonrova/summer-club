import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Gallery } from '@/components/product/gallery'

const images = [
  { path: '/uploads/test-1-1200.avif', alt: 'Bracelet à plat' },
  { path: '/uploads/test-2-1200.avif', alt: 'Bracelet porté' },
]

describe('Gallery', () => {
  it('affiche la première photo en grand avec son texte alternatif', () => {
    render(<Gallery images={images} />)
    expect(screen.getByAltText('Bracelet à plat')).toBeDefined()
    // La seconde photo n'existe qu'en vignette, sans texte alternatif (décorative).
    expect(screen.queryByAltText('Bracelet porté')).toBeNull()
  })

  it('propose une vignette par photo et change la photo affichée au clic', () => {
    render(<Gallery images={images} />)
    const first = screen.getByRole('button', { name: 'Voir la photo 1' })
    const second = screen.getByRole('button', { name: 'Voir la photo 2' })
    expect(first.getAttribute('aria-current')).toBe('true')
    expect(second.getAttribute('aria-current')).toBe('false')

    fireEvent.click(second)

    expect(screen.getByAltText('Bracelet porté')).toBeDefined()
    expect(screen.queryByAltText('Bracelet à plat')).toBeNull()
    expect(second.getAttribute('aria-current')).toBe('true')
  })

  it('ne propose aucune vignette pour une photo unique', () => {
    render(<Gallery images={[images[0]!]} />)
    expect(screen.getByAltText('Bracelet à plat')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ne rend rien sans photo', () => {
    const { container } = render(<Gallery images={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
