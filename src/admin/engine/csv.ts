// Un entier ou un décimal, éventuellement négatif ("-5000", "-12.5") — jamais une
// formule de tableur même s'il commence par "-", contrairement à "-1+1" ou "--5000".
const WELL_FORMED_NUMBER = /^-?\d+(\.\d+)?$/

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // Un tableur interprète =, +, -, @ en tête de cellule comme une formule. Le préfixage
  // par une apostrophe empêche qu'une valeur malveillante (ex. un nom de produit) ne
  // s'exécute chez la personne qui ouvre l'export. Un montant négatif bien formé (une
  // remise, un avoir) n'est pas une formule : on l'exempte pour ne pas le transformer en
  // texte dans le tableur, tout en gardant la protection pour tout le reste ("-1+1",
  // "--5000", "-" seul…).
  if (!WELL_FORMED_NUMBER.test(s) && /^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(escapeCsvValue).join(',')
  const body = rows.map((row) => columns.map((col) => escapeCsvValue(row[col])).join(','))
  return [header, ...body].join('\r\n')
}
