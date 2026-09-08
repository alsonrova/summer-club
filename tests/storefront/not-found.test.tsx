import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound from '@/app/not-found'

// Page 404 racine : toute adresse sans correspondance sous src/app/ aboutit ici (doc Next
// installée, not-found.md : « the root app/not-found.js … handle any unmatched URLs for
// your whole application »). Constat du testeur UX/UI (tâche 14) : sans ce fichier, la
// cliente tombait sur la 404 générique de Next.js — en anglais, sans en-tête ni pied de
// page, sans lien de retour. Le fichier vit hors du groupe (storefront), donc hors de son
// layout : c'est à lui de monter la coque de la vitrine, ce que l'en-tête prouve ici.
describe('page introuvable (racine)', () => {
  it("s'affiche en français, dans la vitrine, avec un retour vers la boutique", () => {
    render(<NotFound />)
    expect(screen.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeDefined()
    expect(screen.getByText("Cette adresse ne mène nulle part. Elle a peut-être changé, ou n'a jamais existé.")).toBeDefined()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Retour à la boutique' }).getAttribute('href')).toBe('/boutique')
    expect(screen.getByRole('contentinfo')).toBeDefined()
  })
})
