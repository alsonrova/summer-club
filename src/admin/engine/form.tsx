import type { ChampAdmin, ResourceConfig } from '../resource'
import type { ErreursValidation } from './actions'

function valeurTexte(valeur: unknown): string {
  return valeur === undefined || valeur === null ? '' : String(valeur)
}

function ChampSaisie({ champ, valeur }: { champ: ChampAdmin; valeur: unknown }) {
  const id = `champ-${champ.name}`

  if (champ.kind === 'boolean') {
    return (
      <input
        id={id}
        type="checkbox"
        name={champ.name}
        defaultChecked={Boolean(valeur)}
        className="h-4 w-4 rounded border-taupe/40"
      />
    )
  }

  if (champ.kind === 'select') {
    return (
      <select
        id={id}
        name={champ.name}
        defaultValue={valeurTexte(valeur)}
        required={champ.requis}
        className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
      >
        <option value="" disabled hidden>
          Choisir…
        </option>
        {(champ.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  const type = champ.kind === 'number' ? 'number' : champ.kind === 'date' ? 'date' : 'text'
  const defaut = champ.kind === 'date' ? valeurTexte(valeur).slice(0, 10) : valeurTexte(valeur)

  return (
    <input
      id={id}
      type={type}
      name={champ.name}
      defaultValue={defaut}
      required={champ.requis}
      className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
    />
  )
}

// Formulaire dérivé du schéma de la ressource : un champ par entrée du schéma, restitution
// des erreurs de validation Zod (déjà en français dans les schémas du domaine) juste sous
// le champ concerné. Pas de validation côté client, pas d'état : `action` est la Server
// Action (ou l'URL) qui traite la soumission et fournit les erreurs éventuelles au
// prochain rendu.
export function AdminForm<T>({
  resource,
  valeursInitiales = {},
  erreurs = {},
  action,
  libelleSoumettre = 'Enregistrer',
}: {
  resource: ResourceConfig<T>
  valeursInitiales?: Record<string, unknown>
  erreurs?: ErreursValidation
  action: string | ((formData: FormData) => void | Promise<void>)
  libelleSoumettre?: string
}) {
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      {resource.fields.map((champ) => {
        const messages = erreurs[champ.name]
        return (
          <div key={champ.name} className="flex flex-col gap-1">
            <label htmlFor={`champ-${champ.name}`} className="text-small text-bark-soft">
              {champ.name}
              {champ.requis ? ' *' : ''}
            </label>
            <ChampSaisie champ={champ} valeur={valeursInitiales[champ.name]} />
            {messages?.map((message) => (
              <p key={message} role="alert" className="text-small text-bark">
                {message}
              </p>
            ))}
          </div>
        )
      })}
      <button
        type="submit"
        className="self-start rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90"
      >
        {libelleSoumettre}
      </button>
    </form>
  )
}
