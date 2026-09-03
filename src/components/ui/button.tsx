import type { ComponentPropsWithoutRef } from 'react'

type ButtonVariant = 'solid' | 'outline'

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
}

// Rayon 999px imposé à tout bouton par la charte (spec § 3.5). `solid` accentue avec
// `sage-deep`, jamais `sage` — interdit pour du texte (spec § 3.2). Le focus clavier
// reste visible (`focus-visible:ring-*`) : aucun état ne se pilote qu'à la souris.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  solid: 'bg-sage-deep text-shell hover:bg-bark',
  outline: 'border border-bark text-bark hover:bg-clay',
}

export function Button({ variant = 'solid', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={[
        'inline-flex items-center justify-center rounded-full px-6 py-2.5 text-small transition-colors duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2',
        'disabled:opacity-60 disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
