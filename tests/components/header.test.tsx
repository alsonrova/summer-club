import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '@/components/layout/header'

describe('Header', () => {
  it('mène à la marque et à la boutique', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: 'Summer Club' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Boutique' }).getAttribute('href')).toBe('/boutique')
  })

  it("ne propose aucun lien « Panier » tant que la route /panier n'existe pas (tâche 16)", () => {
    // Constat du testeur UX/UI (tâche 14) : le lien menait à la 404 générique de Next.js,
    // en anglais, sans en-tête ni pied de page, et son préchargement journalisait quatre
    // erreurs 404 dans la console de chaque fiche. Même raisonnement que le bouton
    // « Ajouter au panier » absent du VariantPicker : un lien mort est un défaut, pas une
    // promesse. La tâche 16 « Panier persistant » remplacera ce test en rendant le lien.
    render(<Header />)
    expect(screen.queryByRole('link', { name: 'Panier' })).toBeNull()
    // Aucun lien de l'en-tête ne vise une adresse qui n'existe pas encore sous src/app/.
    const targets = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(targets).toEqual(['/', '/boutique'])
  })
})
