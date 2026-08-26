import type { ChampAdmin, ResourceConfig } from '../resource'
import type { ErreursValidation } from './actions'

function valeurTexte(valeur: unknown): string {
  return valeur === undefined || valeur === null ? '' : String(valeur)
}

// `idErreur`/`enErreur` relient le champ à son message via aria-describedby/aria-invalid,
// pour qu'un lecteur d'écran annonce l'erreur au moment où il atteint le champ — pas
// seulement quand le message apparaît visuellement (voir AdminForm ci-dessous).
function ChampSaisie({
  champ,
  valeur,
  enErreur,
  idErreur,
}: {
  champ: ChampAdmin
  valeur: unknown
  enErreur: boolean
  idErreur: string
}) {
  const id = `champ-${champ.name}`
  const attrsErreur = enErreur ? { 'aria-invalid': true as const, 'aria-describedby': idErreur } : {}

  if (champ.kind === 'boolean') {
    return (
      <input
        id={id}
        type="checkbox"
        name={champ.name}
        defaultChecked={Boolean(valeur)}
        className="h-4 w-4 rounded border-taupe/40"
        {...attrsErreur}
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
        {...attrsErreur}
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
      {...attrsErreur}
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
        const enErreur = Boolean(messages?.length)
        const idErreur = `erreur-${champ.name}`
        return (
          <div key={champ.name} className="flex flex-col gap-1">
            <label htmlFor={`champ-${champ.name}`} className="text-small text-bark-soft">
              {champ.label}
              {champ.requis ? ' *' : ''}
            </label>
            <ChampSaisie
              champ={champ}
              valeur={valeursInitiales[champ.name]}
              enErreur={enErreur}
              idErreur={idErreur}
            />
            {enErreur ? (
              <div id={idErreur}>
                {messages?.map((message) => (
                  <p key={message} role="alert" className="text-small text-bark">
                    {message}
                  </p>
                ))}
              </div>
            ) : null}
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
