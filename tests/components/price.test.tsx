import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Price } from '@/components/ui/price'

// Même précaution que tests/components/product-card.test.tsx : le normaliseur par défaut
// de testing-library replierait l'espace insécable de formatAriary en espace ASCII, et
// une régression vers une espace ordinaire (§ 5.1 des conventions) passerait inaperçue.
// L'espace insécable s'écrit ici en séquence d'échappement, jamais en caractère brut
// (docs/CONVENTIONS.md § 5.1) — vérifié octet par octet.
const rawText = { normalizer: (text: string) => text }

describe('Price', () => {
  it("n'affiche aucun prix barré quand le prix initial égale le prix final", () => {
    render(<Price amount={45000} initial={45000} />)
    expect(screen.getByText('45\u00A0000\u00A0Ar', rawText)).toBeDefined()
    expect(document.querySelector('s')).toBeNull()
  })

  it('rend le prix barré dans une couleur lisible sur sable — bark-soft, jamais taupe', () => {
    // Jumeau du constat du testeur UX/UI sur la mention « Rupture » du catalogue (§ 4,
    // règle 3 des conventions : après un champ corrigé, chercher son symétrique) : le
    // taupe (#B9A992) sur sable (#F7F3EE) mesure 2,08:1, sous le seuil de 4,5:1
    // (tests/tokens.test.ts). L'ancien prix est une information, pas un ornement : il se
    // lit dans la couleur du texte secondaire, le barré et la sauge du prix final suffisent
    // à les distinguer.
    render(<Price amount={36000} initial={45000} />)
    const struck = screen.getByText('45\u00A0000\u00A0Ar', rawText)
    expect(struck.tagName.toLowerCase()).toBe('s')
    expect(struck.className).toContain('text-bark-soft')
    expect(struck.className).not.toContain('text-taupe')
  })
})
