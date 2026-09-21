'use client'

import { useEffect, useRef, useState } from 'react'

// Apparition au défilement : le contenu monte de 16 px en fondu quand il entre dans le
// champ, une seule fois. `delay` décale les éléments d'un même groupe (une grille de
// cartes, trois avis) pour qu'ils n'arrivent pas d'un bloc.
//
// Deux replis, parce qu'une section qui ne s'affiche QUE sur intersection disparaît
// entièrement là où le mécanisme manque — la page d'accueil n'aurait plus que son hero :
//
//  - **Sans IntersectionObserver** (navigateur ancien, moteur de rendu partiel), l'effet
//    montre le contenu immédiatement. On dégrade vers « visible, sans animation », jamais
//    vers « invisible ».
//  - **Sans JavaScript du tout**, aucun effet ne s'exécute : c'est la règle <noscript> de
//    la page d'accueil qui force l'opacité de ces conteneurs, repérés par `data-reveal`.
//
// `prefers-reduced-motion: reduce` ne demande aucun code ici : la règle globale posée à la
// tâche 1 (src/styles/tokens.css) neutralise `transform` et ramène la durée de transition
// à 0,01 ms — l'opacité bascule alors d'un coup, sans déplacement.
export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        // Une apparition ne se rejoue pas : sans ce `disconnect`, remonter puis redescendre
        // relancerait la transition à chaque passage.
        observer.disconnect()
      },
      // La section doit être franchement entrée dans le champ, pas l'effleurer par un pixel.
      { rootMargin: '-10% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-reveal=""
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 600ms var(--ease-reveal) ${delay}ms, transform 600ms var(--ease-reveal) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}
