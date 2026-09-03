import type { AdminField, ResourceConfig } from '../resource'
import type { ValidationErrors } from './actions'

function textValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

// `errorId`/`hasError` relient le champ à son message via aria-describedby/aria-invalid,
// pour qu'un lecteur d'écran annonce l'erreur au moment où il atteint le champ — pas
// seulement quand le message apparaît visuellement (voir AdminForm ci-dessous).
function InputField({
  field,
  value,
  hasError,
  errorId,
}: {
  field: AdminField
  value: unknown
  hasError: boolean
  errorId: string
}) {
  const id = `champ-${field.name}`
  const errorAttrs = hasError ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}

  if (field.kind === 'boolean') {
    return (
      <input
        id={id}
        type="checkbox"
        name={field.name}
        defaultChecked={Boolean(value)}
        className="h-4 w-4 rounded border-taupe/40"
        {...errorAttrs}
      />
    )
  }

  if (field.kind === 'select') {
    return (
      <select
        id={id}
        name={field.name}
        defaultValue={textValue(value)}
        required={field.required}
        className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        {...errorAttrs}
      >
        <option value="" disabled hidden>
          Choisir…
        </option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  const type = field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'
  const defaultVal = field.kind === 'date' ? textValue(value).slice(0, 10) : textValue(value)

  return (
    <input
      id={id}
      type={type}
      name={field.name}
      defaultValue={defaultVal}
      required={field.required}
      className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
      {...errorAttrs}
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
  initialValues = {},
  errors = {},
  action,
  submitLabel = 'Enregistrer',
}: {
  resource: ResourceConfig<T>
  initialValues?: Record<string, unknown>
  errors?: ValidationErrors
  action: string | ((formData: FormData) => void | Promise<void>)
  submitLabel?: string
}) {
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      {resource.fields.map((field) => {
        const messages = errors[field.name]
        const hasError = Boolean(messages?.length)
        const errorId = `erreur-${field.name}`
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label htmlFor={`champ-${field.name}`} className="text-small text-bark-soft">
              {field.label}
              {field.required ? ' *' : ''}
            </label>
            <InputField
              field={field}
              value={initialValues[field.name]}
              hasError={hasError}
              errorId={errorId}
            />
            {hasError ? (
              <div id={errorId}>
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
        {submitLabel}
      </button>
    </form>
  )
}
