import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Reveal } from '@/components/ui/reveal'

// Faux IntersectionObserver : jsdom n'en fournit aucun (vérifié dans node_modules/jsdom —
// l'API n'y est pas implémentée, § 0 des conventions). C'est une aubaine plutôt qu'une
// gêne : l'absence est justement le cas limite que le composant doit traiter, et le test
// « sans observateur » ci-dessous s'exécute donc sur un jsdom nu, sans rien simuler.
type Observer = { callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }

function stubIntersectionObserver(): Observer[] {
  const observers: Observer[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn()
      observe = vi.fn()
      unobserve = vi.fn()
      takeRecords = vi.fn()
      constructor(callback: IntersectionObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect })
      }
    },
  )
  return observers
}

function intersect(observer: Observer) {
  act(() => {
    observer.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Reveal', () => {
  it("montre le contenu sans attendre quand le navigateur n'a pas d'IntersectionObserver", () => {
    // Une section qui ne s'affiche que sur intersection disparaît entièrement là où l'API
    // manque : la page d'accueil n'aurait plus que son hero. On dégrade vers « visible,
    // sans animation », jamais vers « invisible ».
    render(<Reveal>Acier inoxydable</Reveal>)
    expect(screen.getByText('Acier inoxydable').style.opacity).toBe('1')
  })

  it("masque le contenu jusqu'à son entrée dans le champ, puis cesse d'observer", () => {
    const observers = stubIntersectionObserver()
    render(<Reveal>Plaqué or 18k</Reveal>)

    // getByText rend l'élément qui PORTE le texte : ici le conteneur de Reveal lui-même,
    // puisque l'enfant est un simple nœud de texte.
    const wrapper = screen.getByText('Plaqué or 18k')
    expect(wrapper.style.opacity).toBe('0')

    const observer = observers[0]
    expect(observer).toBeDefined()
    intersect(observer!)

    expect(wrapper.style.opacity).toBe('1')
    // Une apparition ne se rejoue pas : sans ce `disconnect`, remonter puis redescendre
    // rejouerait la transition à chaque passage.
    expect(observer!.disconnect).toHaveBeenCalled()
  })

  it('porte le délai demandé sur la transition, pour décaler les éléments d\'un même groupe', () => {
    stubIntersectionObserver()
    render(<Reveal delay={140}>Résistant à l&apos;eau</Reveal>)
    expect(screen.getByText(/Résistant/).style.transition).toContain('140ms')
  })

  it('marque son conteneur, cible de la règle de repli sans JavaScript', () => {
    // La page d'accueil (src/app/(storefront)/page.tsx) pose un <noscript> qui force
    // l'opacité de ces conteneurs : sans JavaScript, aucun effet ne s'exécute et tout ce
    // qui suit le hero resterait invisible. Le marqueur est le point de rendez-vous des
    // deux moitiés — il ne se renomme pas d'un côté seulement.
    stubIntersectionObserver()
    render(<Reveal>Livraison à Antananarivo</Reveal>)
    expect(screen.getByText('Livraison à Antananarivo').dataset.reveal).toBe('')
  })
})
