import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Reviews, type HomeReview } from '@/components/home/reviews'

const review: HomeReview = {
  id: 'rev-1',
  rating: 5,
  body: 'Porté tous les jours depuis trois mois, il n’a pas bougé.',
  author: 'Mialy',
  source: 'verified',
}

describe('Reviews', () => {
  it('affiche le témoignage et son autrice', () => {
    render(<Reviews reviews={[review]} />)
    expect(screen.getByRole('heading', { name: 'Elles les portent' })).toBeDefined()
    expect(screen.getByText(/Porté tous les jours/)).toBeDefined()
    expect(screen.getByText('Mialy')).toBeDefined()
  })

  it('réserve le badge « Achat vérifié » aux avis vérifiés', () => {
    // Spec § 7 : `source` vaut `verified` (avis rattaché à une commande livrée) ou
    // `imported` (témoignage saisi par la propriétaire depuis Instagram ou WhatsApp).
    // Le badge atteste d'un achat : le poser sur un témoignage importé serait faux.
    render(<Reviews reviews={[review, { ...review, id: 'rev-2', author: 'Hanta', source: 'imported' }]} />)
    expect(screen.getAllByText('Achat vérifié')).toHaveLength(1)
  })

  it('rend la note lisible autrement que par des étoiles', () => {
    render(<Reviews reviews={[{ ...review, rating: 4 }]} />)
    // Cinq caractères, pleins puis vides : la note se lit à l'œil…
    expect(screen.getByLabelText('4 sur 5').textContent).toBe('★★★★☆')
    // …et au lecteur d'écran, qui ne sait pas compter des étoiles.
  })

  it('disparaît entièrement quand aucun avis n’est épinglé', () => {
    const { container } = render(<Reviews reviews={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
