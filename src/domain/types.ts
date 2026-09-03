export type PromotionRule = {
  id: string
  type: 'percent' | 'fixed'
  value: number
  scope: 'product' | 'category' | 'all'
  targetId: string | null
  startsAt: Date | null
  endsAt: Date | null
  weekdays: number
  startHour: number | null
  endHour: number | null
  membersOnly: boolean
  priority: number
  active: boolean
}

export type EffectivePrice = {
  initialPrice: number
  finalPrice: number
  promotionId: string | null
}
