'use client'

import Image from 'next/image'
import { useState } from 'react'

// Galerie d'une fiche : la photo courante dans le cadre en arche (le seul emploi autorisé
// de --radius-arch, spec § 3.5), et une rangée de vignettes dès qu'il y a plus d'une photo.
// Les vignettes sont des boutons nommés (« Voir la photo N ») : sélectionnables au
// clavier, avec `aria-current` pour dire laquelle est affichée. Seule la transition de
// l'anneau bouge ; prefers-reduced-motion est traité globalement (src/styles/tokens.css).
export function Gallery({ images }: { images: { path: string; alt: string }[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const current = images[activeIndex] ?? images[0]
  if (!current) return null

  return (
    <div>
      <div
        className="relative aspect-[4/5] overflow-hidden bg-clay"
        style={{ borderRadius: 'var(--radius-arch)' }}
      >
        <Image
          key={current.path}
          src={current.path}
          alt={current.alt}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex gap-3">
          {images.map((image, index) => (
            <button
              key={image.path}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Voir la photo ${index + 1}`}
              aria-current={index === activeIndex}
              className={`relative aspect-[4/5] w-16 overflow-hidden rounded-lg ring-1 transition-[box-shadow] duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2 ${
                index === activeIndex ? 'ring-sage-deep' : 'ring-taupe/40'
              }`}
            >
              <Image src={image.path} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
