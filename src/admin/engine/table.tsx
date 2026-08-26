import type { ChampAdmin, ResourceConfig } from '../resource'

function formaterValeur(valeur: unknown, kind: ChampAdmin['kind']): string {
  if (valeur === null || valeur === undefined || valeur === '') return '—'
  if (kind === 'boolean') return valeur ? 'Oui' : 'Non'
  if (kind === 'date') {
    const d = valeur instanceof Date ? valeur : new Date(String(valeur))
    return Number.isNaN(d.getTime()) ? String(valeur) : d.toLocaleDateString('fr-FR')
  }
  return String(valeur)
}

// Reconstruit une querystring en conservant les filtres actifs lors d'un changement de
// page, pour ne pas les perdre à la pagination.
function construireUrl(cheminBase: string, filtres: Record<string, string>, page?: number): string {
  const params = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur) params.set(cle, valeur)
  }
  if (page && page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${cheminBase}?${qs}` : cheminBase
}

// Table paginée minimale, dérivée de la config de ressource : colonnes déclarées, filtres
// déclarés, aucun état côté client (tout passe par l'URL, comme une page Next.js server-
// rendue classique). Pas de tri de colonnes, de sélection multiple ni de recherche plein
// texte : hors périmètre de cette tâche.
export function AdminTable<T extends Record<string, unknown>>({
  resource,
  lignes,
  cheminBase,
  page,
  totalPages,
  filtres = {},
  formatColonnes = {},
  lien,
}: {
  resource: ResourceConfig<T>
  lignes: T[]
  cheminBase: string
  page: number
  totalPages: number
  filtres?: Record<string, string>
  // Dérogation ponctuelle au formatage générique de formaterValeur, colonne par colonne —
  // pour une devise (Ariary, via formatAriary) par exemple, que `ChampAdmin['kind']` ne
  // modélise pas. Optionnel et rétrocompatible : une ressource qui ne le fournit pas
  // conserve exactement le rendu précédent.
  formatColonnes?: Partial<Record<keyof T, (valeur: unknown) => string>>
  // Rend une colonne cliquable vers la fiche de la ligne (ex. la fiche produit) — sans quoi
  // AdminTable ne pose aucun lien et la seule façon d'atteindre une fiche existante est de
  // taper l'URL à la main. Optionnel et rétrocompatible : une ressource qui ne le fournit
  // pas conserve exactement le rendu précédent (cellules en texte brut).
  lien?: { colonne: keyof T; vers: (ligne: T) => string }
}) {
  const champsParNom = new Map(resource.fields.map((champ) => [champ.name, champ]))

  return (
    <div>
      {resource.filters.length > 0 ? (
        <form method="get" action={cheminBase} className="mb-4 flex flex-wrap items-end gap-3">
          {resource.filters.map((nom) => (
            <label key={nom} className="flex flex-col text-small text-bark-soft">
              {champsParNom.get(nom)?.label ?? nom}
              <input
                type="text"
                name={nom}
                defaultValue={filtres[nom] ?? ''}
                className="rounded border border-taupe/40 bg-shell px-2 py-1 text-bark"
              />
            </label>
          ))}
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
              // surchargé via `libelles` dans defineResource).
              const champ = champsParNom.get(String(col))
              return (
                <th key={String(col)} className="px-3 py-2 text-small font-medium text-bark-soft">
                  {champ?.label ?? String(col)}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {lignes.length === 0 ? (
            <tr>
              <td colSpan={resource.columns.length} className="px-3 py-6 text-center text-bark-soft">
                Aucun résultat.
              </td>
            </tr>
          ) : (
            lignes.map((ligne, index) => {
              const cle = typeof ligne['id'] === 'string' ? (ligne['id'] as string) : index
              return (
                <tr key={cle} className="border-b border-taupe/40">
                  {resource.columns.map((col) => {
                    const champ = champsParNom.get(String(col))
                    const estNombre = champ?.kind === 'number'
                    const formateur = formatColonnes[col]
                    const texte = formateur
                      ? formateur(ligne[col as keyof T])
                      : formaterValeur(ligne[col as keyof T], champ?.kind ?? 'text')
                    const estColonneLien = lien !== undefined && col === lien.colonne
                    return (
                      <td
                        key={String(col)}
                        className={`px-3 py-2 text-bark${estNombre ? ' tabular-nums' : ''}`}
                      >
                        {estColonneLien ? (
                          // <a> ordinaire, pas <Link> : typedRoutes (next.config.ts) ne
                          // type `href` que pour des routes littérales connues au moment de
                          // la compilation, pas pour une URL construite dynamiquement à
                          // partir de l'identifiant de la ligne — même raison que
                          // construireUrl ci-dessus pour la pagination.
                          <a href={lien.vers(ligne)} className="underline hover:no-underline">
                            {texte}
                          </a>
                        ) : (
                          texte
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
            <a href={construireUrl(cheminBase, filtres, page - 1)} className="underline">
              Précédent
            </a>
          ) : (
            <span className="opacity-40">Précédent</span>
          )}
          <span className="tabular-nums">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <a href={construireUrl(cheminBase, filtres, page + 1)} className="underline">
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
