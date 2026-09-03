import Link from 'next/link'
import type { Route } from 'next'
import type { AdminField, ResourceConfig } from '../resource'

function formatValue(value: unknown, kind: AdminField['kind']): string {
  if (value === null || value === undefined || value === '') return '—'
  if (kind === 'boolean') return value ? 'Oui' : 'Non'
  if (kind === 'date') {
    const d = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR')
  }
  return String(value)
}

// Reconstruit une querystring en conservant les filtres actifs lors d'un changement de
// page, pour ne pas les perdre à la pagination.
function buildUrl(basePath: string, filters: Record<string, string>, page?: number): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  if (page && page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

// Table paginée minimale, dérivée de la config de ressource : colonnes déclarées, filtres
// déclarés, aucun état côté client (tout passe par l'URL, comme une page Next.js server-
// rendue classique). Pas de tri de colonnes, de sélection multiple ni de recherche plein
// texte : hors périmètre de cette tâche.
export function AdminTable<T extends Record<string, unknown>>({
  resource,
  rows,
  basePath,
  page,
  totalPages,
  filters = {},
  columnFormatters = {},
  filterOptions = {},
  link,
}: {
  resource: ResourceConfig<T>
  rows: T[]
  basePath: string
  page: number
  totalPages: number
  filters?: Record<string, string>
  // Dérogation ponctuelle au formatage générique de formatValue, colonne par colonne —
  // pour une devise (Ariary, via formatAriary) par exemple, que `AdminField['kind']` ne
  // modélise pas. Optionnel et rétrocompatible : une ressource qui ne le fournit pas
  // conserve exactement le rendu précédent.
  columnFormatters?: Partial<Record<keyof T, (value: unknown) => string>>
  // Remplace le champ texte d'un filtre par une liste déroulante libellée. Nécessaire dès
  // qu'un filtre porte sur une énumération : demander à la propriétaire de taper
  // « en_attente_confirmation » à la main n'est pas une interface, c'est un piège à fautes
  // de frappe qui ne renvoie jamais rien. Optionnel et rétrocompatible : un filtre absent
  // de cet objet conserve exactement le champ texte précédent.
  filterOptions?: Record<string, { value: string; label: string }[]>
  // Rend une colonne cliquable vers la fiche de la ligne (ex. la fiche produit) — sans quoi
  // AdminTable ne pose aucun lien et la seule façon d'atteindre une fiche existante est de
  // taper l'URL à la main. Optionnel et rétrocompatible : une ressource qui ne le fournit
  // pas conserve exactement le rendu précédent (cellules en texte brut).
  link?: { column: keyof T; to: (row: T) => string }
}) {
  const fieldsByName = new Map(resource.fields.map((field) => [field.name, field]))

  return (
    <div>
      {resource.filters.length > 0 ? (
        <form method="get" action={basePath} className="mb-4 flex flex-wrap items-end gap-3">
          {resource.filters.map((name) => {
            const options = filterOptions[name]
            return (
              <label key={name} className="flex flex-col text-small text-bark-soft">
                {fieldsByName.get(name)?.label ?? name}
                {options ? (
                  <select
                    name={name}
                    defaultValue={filters[name] ?? ''}
                    className="rounded border border-taupe/40 bg-shell px-2 py-1 text-bark"
                  >
                    <option value="">Tous</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name={name}
                    defaultValue={filters[name] ?? ''}
                    className="rounded border border-taupe/40 bg-shell px-2 py-1 text-bark"
                  />
                )}
              </label>
            )
          })}
          <button
            type="submit"
            className="rounded border border-taupe/40 bg-shell px-3 py-1 text-bark-soft hover:text-bark"
          >
            Filtrer
          </button>
        </form>
      ) : null}

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-taupe/40">
            {resource.columns.map((col) => {
              // La clé brute du schéma ("categoryId", "prixBase"…) n'est présentable que
              // par accident ; resource.fields porte déjà le libellé français dérivé (ou
              // surchargé via `labels` dans defineResource).
              const field = fieldsByName.get(String(col))
              return (
                <th key={String(col)} className="px-3 py-2 text-small font-medium text-bark-soft">
                  {field?.label ?? String(col)}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={resource.columns.length} className="px-3 py-6 text-center text-bark-soft">
                Aucun résultat.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const key = typeof row['id'] === 'string' ? (row['id'] as string) : index
              return (
                <tr key={key} className="border-b border-taupe/40">
                  {resource.columns.map((col) => {
                    const field = fieldsByName.get(String(col))
                    const isNumber = field?.kind === 'number'
                    const formatter = columnFormatters[col]
                    const text = formatter
                      ? formatter(row[col as keyof T])
                      : formatValue(row[col as keyof T], field?.kind ?? 'text')
                    const isLinkColumn = link !== undefined && col === link.column
                    return (
                      <td
                        key={String(col)}
                        className={`px-3 py-2 text-bark${isNumber ? ' tabular-nums' : ''}`}
                      >
                        {isLinkColumn ? (
                          // <Link>, pas <a> : un <a> ordinaire recharge toute la page
                          // (nouvelle requête, perte de l'état client) là où la navigation
                          // de Next.js ne remplace que la partie changée. typedRoutes
                          // (next.config.ts) ne type `href` que pour des routes littérales
                          // connues à la compilation ; pour une URL construite à partir de
                          // l'identifiant de la ligne, la documentation prescrit
                          // explicitement le cast `as Route` (voir
                          // node_modules/next/dist/docs/01-app/03-api-reference/05-config/
                          // 02-typescript.md, « Statically Typed Links »).
                          <Link
                            href={link.to(row) as Route}
                            className="underline hover:no-underline"
                          >
                            {text}
                          </Link>
                        ) : (
                          text
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {totalPages > 1 ? (
        <nav className="mt-4 flex items-center gap-4 text-small text-bark-soft">
          {page > 1 ? (
            <a href={buildUrl(basePath, filters, page - 1)} className="underline">
              Précédent
            </a>
          ) : (
            <span className="opacity-40">Précédent</span>
          )}
          <span className="tabular-nums">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <a href={buildUrl(basePath, filters, page + 1)} className="underline">
              Suivant
            </a>
          ) : (
            <span className="opacity-40">Suivant</span>
          )}
        </nav>
      ) : null}
    </div>
  )
}
