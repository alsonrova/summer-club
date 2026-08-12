const NBSP = '\u00A0'

export function formatAriary(montant: number): string {
  const entier = Math.round(montant)
  const groupes = entier.toLocaleString('fr-FR').replace(/\s|\u202F/g, NBSP)
  return `${groupes}${NBSP}Ar`
}

export function appliquerPourcentage(montant: number, pourcentage: number): number {
  const remise = Math.round((montant * pourcentage) / 100)
  return Math.max(0, montant - remise)
}
