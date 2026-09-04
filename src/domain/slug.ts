// Forme d'un slug de produit : minuscules ASCII, chiffres et tirets — ce que le
// back-office accepte à l'écriture (productSchema, src/admin/resources/products.ts) et donc
// la seule forme qui puisse exister en base. La vitrine s'en sert comme liste blanche
// AVANT toute requête : un slug vient de l'URL, donc de n'importe qui, et une valeur qui
// ne peut pas exister ne vaut pas une requête — un NUL ferait même lever PostgreSQL
// (« invalid byte sequence for encoding UTF8 », mesuré), soit un 500 au lieu d'un 404.
// Une seule définition, partagée par l'écriture et la lecture, pour qu'elles ne divergent
// jamais (docs/CONVENTIONS.md § 4, règle 3 : après avoir corrigé un champ, cherchez son
// jumeau).
export const SLUG_PATTERN = /^[a-z0-9-]+$/

export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value)
}
