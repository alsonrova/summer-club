'use client'

import { useState } from 'react'
import { Price } from '@/components/ui/price'
import type { ProductDetail } from '@/server/products'

// Choix de la déclinaison d'une fiche, prix correspondant, et état de rupture en texte.
//
// Aucun bouton « Ajouter au panier » ici : le magasin du panier arrive avec la tâche 16,
// et un bouton sans effet serait un défaut d'interface pire qu'une absence. Il prendra
// place sous le prix, à la place du message de rupture quand la déclinaison est disponible.
//
// Une déclinaison épuisée reste sélectionnable : la charte (spec § 3.8) veut que la
// rupture s'explique par du texte, pas par un contrôle grisé qui ne dit rien au toucher.
// La choisir affiche le message ; son libellé est barré pour l'annoncer avant le choix.
//
// Le composant ne reçoit que ce qu'il lit (Pick) : composant client, tout ce qu'on lui
// passe est sérialisé dans la charge RSC de la fiche — la description, les photos et les
// métadonnées n'ont rien à y faire une seconde fois.
export type VariantPickerProduct = Pick<ProductDetail, 'variants' | 'finalPrice' | 'initialPrice'>

export function VariantPicker({ product }: { product: VariantPickerProduct }) {
  const firstAvailable = product.variants.find((v) => v.available) ?? product.variants[0]
  const [selectedId, setSelectedId] = useState(firstAvailable?.id ?? '')
  const selected = product.variants.find((v) => v.id === selectedId)

  return (
    <div className="mt-10">
      {product.variants.length > 0 && (
        <fieldset>
          <legend className="text-eyebrow uppercase tracking-[.16em] text-bark-soft">
            Déclinaison
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <label key={variant.id}>
                <input
                  type="radio"
                  name="variant"
                  value={variant.id}
                  checked={selectedId === variant.id}
                  onChange={() => setSelectedId(variant.id)}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-full border border-taupe/60 px-5 py-2.5 text-small transition-colors duration-[180ms] peer-checked:border-sage-deep peer-checked:bg-clay peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage-deep">
                  {variant.available ? (
                    variant.label
                  ) : (
                    <s className="text-bark-soft">
                      {variant.label}
                      <span className="sr-only"> (rupture)</span>
                    </s>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="mt-8 text-lg">
        <Price
          amount={selected?.price ?? product.finalPrice}
          initial={selected?.initialPrice ?? product.initialPrice}
        />
      </p>

      {!selected?.available && (
        <p className="mt-6 text-small text-bark-soft">Rupture — cette pièce revient bientôt.</p>
      )}
    </div>
  )
}
