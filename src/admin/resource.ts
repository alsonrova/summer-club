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

export type ChampAdmin = {
  name: string
  kind: 'text' | 'number' | 'boolean' | 'date' | 'select'
  requis: boolean
  // Libellé affiché par form.tsx : la clé du schéma capitalisée par défaut, ou la
  // surcharge fournie via `libelles` quand la clé brute n'est pas présentable
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
  fields: ChampAdmin[]
  // Clés du schéma gérées par la base plutôt que par la personne qui remplit le
  // formulaire (voir CHAMPS_SYSTEME_PAR_DEFAUT ci-dessous) — conservé sur la config pour
  // qu'actions.ts puisse les retirer des données juste avant l'écriture Prisma.
  champsSysteme: string[]
}

// Une ressource dérive ses champs de formulaire de TOUTES les clés de son schéma Zod. Si
// ce schéma décrit aussi des colonnes gérées par la base (identifiant, horodatages de
// création/mise à jour), les exposer à la saisie permettrait à quiconque de forger un
// `id` ou une date arbitraire dans le formulaire soumis — et `creerRessource` /
// `modifierRessource` (voir actions.ts) les écriraient tels quels vers Prisma. Cette
// liste par défaut écarte ce risque pour toute ressource qui ne la surcharge pas
// explicitement.
const CHAMPS_SYSTEME_PAR_DEFAUT = ['id', 'createdAt', 'updatedAt']

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

// Première lettre en majuscule : un minimum de présentabilité pour un libellé de
// formulaire dérivé automatiquement d'une clé de schéma ("nom" -> "Nom"). Ne rend pas une
// clé en camelCase lisible pour autant ("categoryId" -> "CategoryId") — c'est précisément
// pour ces cas que `libelles` permet à une ressource de fournir un vrai libellé.
function capitaliser(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1)
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
  // Surcharge de CHAMPS_SYSTEME_PAR_DEFAUT, pour une ressource qui aurait une raison
  // précise de gérer autrement ses colonnes techniques.
  champsSysteme?: string[]
  // Libellés de formulaire surchargeant la capitalisation automatique, par nom de champ
  // (ex. { categoryId: 'Catégorie', metaTitle: 'Titre méta' }).
  libelles?: Record<string, string>
}): ResourceConfig<T> {
  const shape = config.schema.shape
  const connus = Object.keys(shape)
  const champsSysteme = config.champsSysteme ?? CHAMPS_SYSTEME_PAR_DEFAUT

  for (const col of config.columns) {
    if (!connus.includes(String(col))) {
      throw new Error(
        `defineResource("${config.name}") : la colonne "${String(col)}" n'existe pas dans le schéma`,
      )
    }
  }

  const fields: ChampAdmin[] = connus
    .filter((name) => !champsSysteme.includes(name))
    .map((name) => {
      const { kind, options } = analyserChamp(shape[name])
      return {
        name,
        kind,
        requis: !shape[name]!.isOptional(),
        label: config.libelles?.[name] ?? capitaliser(name),
        ...(options ? { options } : {}),
      }
    })

  return {
    ...config,
    filters: config.filters ?? [],
    actions: config.actions ?? [],
    champsSysteme,
    fields,
  }
}
