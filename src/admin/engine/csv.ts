function echapper(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  let s = String(valeur)
  // Un tableur interprète =, +, -, @ en tête de cellule comme une formule. Le préfixage
  // par une apostrophe empêche qu'une valeur malveillante (ex. un nom de produit) ne
  // s'exécute chez la personne qui ouvre l'export.
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function versCSV(lignes: Record<string, unknown>[], colonnes: string[]): string {
  const entete = colonnes.map(echapper).join(',')
  const corps = lignes.map((l) => colonnes.map((c) => echapper(l[c])).join(','))
  return [entete, ...corps].join('\r\n')
}
