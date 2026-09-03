import { z, type ZodObject } from 'zod'
import { fr } from 'zod/locales'

// L'interface d'administration est en français, mais zod ne produit ses messages de
// validation par défaut (min/max/type attendu…) qu'en anglais tant qu'aucune locale n'est
// configurée. zod 4.4.3 embarque une locale française prête à l'emploi
// (node_modules/zod/locales/fr.js, réexportée par le sous-chemin `zod/locales`) : on
// l'active ici, globalement, car ce module (`resource.ts`) est le point de passage
// obligé de toute ressource d'administration — `defineResource` doit avoir tourné avant
// qu'un schéma ne serve à valider quoi que ce soit. Un message personnalisé fourni par un
// schéma (ex. `z.string().min(2, 'Le nom est requis')`) reste prioritaire sur la locale :
// vérifié par `node -e` (voir le rapport de tâche).
z.config(fr())

// L'interface publique du moteur (voir le brief) déclare `schema: ZodObject<any>` : en
// zod 4, `ZodObject<ZodRawShape>` (calqué sur l'ancienne API zod 3) type les valeurs de
// `.shape` via `core.$ZodShape`, qui n'expose pas les méthodes de l'API classique comme
// `isOptional()` — seul le générique `any` (donnant `$ZodLooseShape`, la valeur par
// défaut de ZodObject) laisse `.shape[name]` exposer l'instance classique complète.
type SchemaAdmin = ZodObject<any>

export type AdminField = {
  name: string
  kind: 'text' | 'number' | 'boolean' | 'date' | 'select'
  required: boolean
  // Libellé affiché par form.tsx : la clé du schéma capitalisée par défaut, ou la
  // surcharge fournie via `labels` quand la clé brute n'est pas présentable
  // (`categoryId`, `metaTitle`…).
  label: string
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
  fields: AdminField[]
  // Clés du schéma gérées par la base plutôt que par la personne qui remplit le
  // formulaire (voir DEFAULT_SYSTEM_FIELDS ci-dessous) — conservé sur la config pour
  // qu'actions.ts puisse les retirer des données juste avant l'écriture Prisma.
  systemFields: string[]
}

// Une ressource dérive ses champs de formulaire de TOUTES les clés de son schéma Zod. Si
// ce schéma décrit aussi des colonnes gérées par la base (identifiant, horodatages de
// création/mise à jour), les exposer à la saisie permettrait à quiconque de forger un
// `id` ou une date arbitraire dans le formulaire soumis — et `createResource` /
// `updateResource` (voir actions.ts) les écriraient tels quels vers Prisma. Cette
// liste par défaut écarte ce risque pour toute ressource qui ne la surcharge pas
// explicitement.
const DEFAULT_SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt']

// zod 4 expose le type d'un schéma via `_def.type` (une chaîne comme 'string', 'number',
// 'boolean', 'date', 'enum'…) et non plus via `_def.typeName` ('ZodNumber', 'ZodBoolean'…)
// comme en zod 3. Vérifié avec `node -e` contre la version installée (zod 4.4.3) : pour
// z.number(), `_def` vaut `{ type: 'number', checks: [...] }` — `_def.typeName` y est
// `undefined`, ce qui classerait silencieusement tous les champs en texte.
//
// Un wrapper (`.optional()`, `.nullable()`, `.default()`) porte lui-même un `_def.type`
// ('optional' / 'nullable' / 'default') et place le schéma réel dans `_def.innerType` :
// on déroule ces enveloppes pour retrouver le type concret du champ.
type InternalZodDef = {
  type?: string
  innerType?: unknown
  entries?: Record<string, string>
}

// Première lettre en majuscule : un minimum de présentabilité pour un libellé de
// formulaire dérivé automatiquement d'une clé de schéma ("name" -> "Name"). Ne rend pas une
// clé en camelCase lisible pour autant ("categoryId" -> "CategoryId") — c'est précisément
// pour ces cas que `labels` permet à une ressource de fournir un vrai libellé.
function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1)
}

function analyzeField(def: unknown): { kind: AdminField['kind']; options?: string[] } {
  const zodDef = (def as { _def?: InternalZodDef })._def
  const typeName = zodDef?.type ?? ''

  if (typeName === 'optional' || typeName === 'nullable' || typeName === 'default') {
    return analyzeField(zodDef?.innerType)
  }
  if (typeName === 'number') return { kind: 'number' }
  if (typeName === 'boolean') return { kind: 'boolean' }
  if (typeName === 'date') return { kind: 'date' }
  if (typeName === 'enum') return { kind: 'select', options: Object.keys(zodDef?.entries ?? {}) }
  return { kind: 'text' }
}

export function defineResource<T>(config: {
  name: string
  label: string
  schema: SchemaAdmin
  columns: (keyof T)[]
  filters?: string[]
  actions?: string[]
  // Surcharge de DEFAULT_SYSTEM_FIELDS, pour une ressource qui aurait une raison
  // précise de gérer autrement ses colonnes techniques.
  systemFields?: string[]
  // Libellés de formulaire surchargeant la capitalisation automatique, par nom de champ
  // (ex. { categoryId: 'Catégorie', metaTitle: 'Titre méta' }).
  labels?: Record<string, string>
}): ResourceConfig<T> {
  const shape = config.schema.shape
  const knownKeys = Object.keys(shape)
  const systemFields = config.systemFields ?? DEFAULT_SYSTEM_FIELDS

  for (const col of config.columns) {
    if (!knownKeys.includes(String(col))) {
      throw new Error(
        `defineResource("${config.name}") : la colonne "${String(col)}" n'existe pas dans le schéma`,
      )
    }
  }

  const fields: AdminField[] = knownKeys
    .filter((name) => !systemFields.includes(name))
    .map((name) => {
      const { kind, options } = analyzeField(shape[name])
      return {
        name,
        kind,
        required: !shape[name]!.isOptional(),
        label: config.labels?.[name] ?? capitalize(name),
        ...(options ? { options } : {}),
      }
    })

  return {
    ...config,
    filters: config.filters ?? [],
    actions: config.actions ?? [],
    systemFields,
    fields,
  }
}
