// Un entier ou un décimal, éventuellement négatif ("-5000", "-12.5") — jamais une
// formule de tableur même s'il commence par "-", contrairement à "-1+1" ou "--5000".
const NOMBRE_BIEN_FORME = /^-?\d+(\.\d+)?$/

function echapper(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  let s = String(valeur)
  // Un tableur interprète =, +, -, @ en tête de cellule comme une formule. Le préfixage
  // par une apostrophe empêche qu'une valeur malveillante (ex. un nom de produit) ne
  // s'exécute chez la personne qui ouvre l'export. Un montant négatif bien formé (une
  // remise, un avoir) n'est pas une formule : on l'exempte pour ne pas le transformer en
  // texte dans le tableur, tout en gardant la protection pour tout le reste ("-1+1",
  // "--5000", "-" seul…).
  if (!NOMBRE_BIEN_FORME.test(s) && /^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function versCSV(lignes: Record<string, unknown>[], colonnes: string[]): string {
  const entete = colonnes.map(echapper).join(',')
  const corps = lignes.map((l) => colonnes.map((c) => echapper(l[c])).join(','))
  return [entete, ...corps].join('\r\n')
}
