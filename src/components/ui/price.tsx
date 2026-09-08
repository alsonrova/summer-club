import { formatAriary } from '@/domain/money'

// Le prix barré ne s'affiche que si un prix initial existe ET qu'il est strictement
// supérieur au prix final : un `initial` égal au prix final (produit sans promotion)
// ne doit rien barrer.
//
// L'ancien prix est une information, pas un ornement : il se lit dans la couleur du texte
// secondaire (bark-soft, 5,37:1 sur sable), le barré et la sauge du prix final suffisant à
// les distinguer. Le taupe, lui, ne dépasse pas 2,08:1 sur sable (tests/tokens.test.ts) —
// jumeau du constat du testeur UX/UI sur la mention « Rupture » du catalogue (tâche 14),
// corrigé en même temps (docs/CONVENTIONS.md § 4, règle 3 : après un cas corrigé, son
// symétrique).
export function Price({ amount, initial }: { amount: number; initial?: number }) {
  const isDiscounted = initial !== undefined && initial > amount

  return (
    <span className="tabular-nums text-bark-soft">
      {isDiscounted && <s className="mr-2 text-bark-soft">{formatAriary(initial)}</s>}
      <span className={isDiscounted ? 'text-sage-deep' : undefined}>{formatAriary(amount)}</span>
    </span>
  )
}
