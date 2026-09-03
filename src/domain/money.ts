const NBSP = '\u00A0'

export function formatAriary(amount: number): string {
  const rounded = Math.round(amount)
  const grouped = rounded.toLocaleString('fr-FR').replace(/\s|\u202F/g, NBSP)
  return `${grouped}${NBSP}Ar`
}

export function applyPercentage(amount: number, percentage: number): number {
  const discount = Math.round((amount * percentage) / 100)
  return Math.max(0, amount - discount)
}
