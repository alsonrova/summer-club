import type { ZodObject } from 'zod'

// L'interface publique du moteur (voir le brief) déclare `schema: ZodObject<any>` : en
// zod 4, `ZodObject<ZodRawShape>` (calqué sur l'ancienne API zod 3) type les valeurs de
// `.shape` via `core.$ZodShape`, qui n'expose pas les méthodes de l'API classique comme
// `isOptional()` — seul le générique `any` (donnant `$ZodLooseShape`, la valeur par
// défaut de ZodObject) laisse `.shape[name]` exposer l'instance classique complète.
type SchemaAdmin = ZodObject<any>

export type ChampAdmin = {
  name: string
  kind: 'text' | 'number' | 'boolean' | 'date' | 'select'
  requis: boolean
  // Uniquement pour kind === 'select' : les valeurs de l'énumération, dans l'ordre du
  // schéma — form.tsx en a besoin pour générer les <option> réelles.
  options?: string[]
}

export type ResourceConfig<T> = {
  name: string
  label: string
  schema: SchemaAdmin
  columns: (keyof T)[]
  filters: string[]
  actions: string[]
  fields: ChampAdmin[]
}

// zod 4 expose le type d'un schéma via `_def.type` (une chaîne comme 'string', 'number',
// 'boolean', 'date', 'enum'…) et non plus via `_def.typeName` ('ZodNumber', 'ZodBoolean'…)
// comme en zod 3. Vérifié avec `node -e` contre la version installée (zod 4.4.3) : pour
// z.number(), `_def` vaut `{ type: 'number', checks: [...] }` — `_def.typeName` y est
// `undefined`, ce qui classerait silencieusement tous les champs en texte.
//
// Un wrapper (`.optional()`, `.nullable()`, `.default()`) porte lui-même un `_def.type`
// ('optional' / 'nullable' / 'default') et place le schéma réel dans `_def.innerType` :
// on déroule ces enveloppes pour retrouver le type concret du champ.
type ZodDefInterne = {
  type?: string
  innerType?: unknown
  entries?: Record<string, string>
}

function analyserChamp(def: unknown): { kind: ChampAdmin['kind']; options?: string[] } {
  const zodDef = (def as { _def?: ZodDefInterne })._def
  const nom = zodDef?.type ?? ''

  if (nom === 'optional' || nom === 'nullable' || nom === 'default') {
    return analyserChamp(zodDef?.innerType)
  }
  if (nom === 'number') return { kind: 'number' }
  if (nom === 'boolean') return { kind: 'boolean' }
  if (nom === 'date') return { kind: 'date' }
  if (nom === 'enum') return { kind: 'select', options: Object.keys(zodDef?.entries ?? {}) }
  return { kind: 'text' }
}

export function defineResource<T>(config: {
  name: string
  label: string
  schema: SchemaAdmin
  columns: (keyof T)[]
  filters?: string[]
  actions?: string[]
}): ResourceConfig<T> {
  const shape = config.schema.shape
  const connus = Object.keys(shape)

  for (const col of config.columns) {
    if (!connus.includes(String(col))) {
      throw new Error(
        `defineResource("${config.name}") : la colonne "${String(col)}" n'existe pas dans le schéma`,
      )
    }
  }

  const fields: ChampAdmin[] = connus.map((name) => {
    const { kind, options } = analyserChamp(shape[name])
    return {
      name,
      kind,
      requis: !shape[name]!.isOptional(),
      ...(options ? { options } : {}),
    }
  })

  return {
    ...config,
    filters: config.filters ?? [],
    actions: config.actions ?? [],
    fields,
  }
}
