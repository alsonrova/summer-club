const NBSP = ' '

export function formatAriary(montant: number): string {
  const entier = Math.round(montant)
  const groupes = entier.toLocaleString('fr-FR').replace(/\s| /g, NBSP)
  return `${groupes}${NBSP}Ar`
}

export function appliquerPourcentage(montant: number, pourcentage: number): number {
  const remise = Math.round((montant * pourcentage) / 100)
  return Math.max(0, montant - remise)
}
