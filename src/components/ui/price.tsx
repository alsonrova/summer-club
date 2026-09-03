import { formatAriary } from '@/domain/money'

// Le prix barré ne s'affiche que si un prix initial existe ET qu'il est strictement
// supérieur au prix final : un `initial` égal au prix final (produit sans promotion)
// ne doit rien barrer.
export function Price({ amount, initial }: { amount: number; initial?: number }) {
  const isDiscounted = initial !== undefined && initial > amount

  return (
    <span className="tabular-nums text-bark-soft">
      {isDiscounted && <s className="mr-2 text-taupe">{formatAriary(initial)}</s>}
      <span className={isDiscounted ? 'text-sage-deep' : undefined}>{formatAriary(amount)}</span>
    </span>
  )
}
