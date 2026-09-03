import { requireAdmin } from '@/server/auth'
import { recordAudit } from '@/server/audit'
import type { ResourceConfig } from '../resource'

export type ValidationErrors = Record<string, string[]>

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationErrors }

// Un <form> HTML ne transmet que des chaînes (et l'absence de clé pour une case à cocher
// non cochée). On convertit vers les types attendus par le schéma Zod de la ressource
// avant validation : sans cette étape, un champ `number` resterait une chaîne et
// échouerait systématiquement (z.number() refuse "45000").
export function formDataToObject<T>(
  formData: FormData,
  resource: ResourceConfig<T>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const field of resource.fields) {
    if (field.kind === 'boolean') {
      result[field.name] = formData.has(field.name)
      continue
    }

    const value = formData.get(field.name)
    if (value === null) continue
    const s = String(value)

    if (field.kind === 'number') {
      result[field.name] = s === '' ? undefined : Number(s)
    } else if (field.kind === 'date') {
      result[field.name] = s === '' ? undefined : new Date(s)
    } else {
      result[field.name] = s
    }
  }

  return result
}

// Regroupe les messages d'erreur Zod (déjà en français dans les schémas du domaine) par
// nom de champ, pour que form.tsx puisse les afficher sous chaque entrée.
export function validateFormData<T>(
  resource: ResourceConfig<T>,
  formData: FormData,
): ValidationResult<T> {
  const raw = formDataToObject(formData, resource)
  const parsed = resource.schema.safeParse(raw)

  if (parsed.success) {
    return { success: true, data: parsed.data as T }
  }

  const errors: ValidationErrors = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : '_root'
    ;(errors[key] ??= []).push(issue.message)
  }
  return { success: false, errors }
}

// Retire les champs système (id, createdAt, updatedAt par défaut — voir
// DEFAULT_SYSTEM_FIELDS dans resource.ts) des données validées, juste avant
// l'écriture Prisma. Nécessaire même si formDataToObject ne les collecte déjà plus
// depuis le FormData (ils sont absents de resource.fields) : un schéma peut leur donner
// une valeur par défaut (`z.string().default(...)`), que Zod applique alors aux données
// analysées malgré leur absence du formulaire soumis — sans ce retrait, cette valeur par
// défaut (ou un id forgé si le schéma ne le rend pas optionnel) partirait telle quelle
// vers `delegate.create`/`delegate.update`.
function omitSystemFields(
  data: Record<string, unknown>,
  systemFields: string[],
): Record<string, unknown> {
  const copy = { ...data }
  for (const field of systemFields) {
    delete copy[field]
  }
  return copy
}

// Sous-ensemble du delegate Prisma généré (ex. `prisma.product`) dont l'engine a besoin.
// Une ressource concrète (tâche 11+) fournit son propre delegate : l'engine reste
// indépendant de tout modèle Prisma précis.
export type DelegatePrisma<T> = {
  findUnique: (args: { where: { id: string } }) => Promise<(T & { id: string }) | null>
  create: (args: { data: T }) => Promise<T & { id: string }>
  update: (args: { where: { id: string }; data: Partial<T> }) => Promise<T & { id: string }>
  delete: (args: { where: { id: string } }) => Promise<T & { id: string }>
}

// Ces trois fonctions sont les briques que les Server Actions concrètes (une par
// ressource, définies là où le delegate Prisma existe réellement) appellent. Elles ne
// sont pas elles-mêmes des Server Actions : chaque route d'administration qui les utilise
// doit rester déclarée avec 'use server' et respecter la convention de sécurité — un appel
// à requireAdmin() ici ne dispense pas la Server Action appelante d'en faire un elle-même
// au plus près de sa propre définition, mais protège ce module si jamais il est invoqué
// autrement.
export async function createResource<T extends Record<string, unknown>>(
  resource: ResourceConfig<T>,
  delegate: DelegatePrisma<T>,
  formData: FormData,
): Promise<ValidationResult<T>> {
  const session = await requireAdmin()
  const result = validateFormData(resource, formData)
  if (!result.success) return result

  // Le cast vers T est sûr : `dataToWrite` est `result.data` privé des seules
  // clés listées dans `resource.systemFields`, et le delegate Prisma réel génère ces
  // colonnes lui-même (id, createdAt, updatedAt) — il ne les exige jamais en écriture.
  const dataToWrite = omitSystemFields(result.data, resource.systemFields) as T
  const created = await delegate.create({ data: dataToWrite })
  await recordAudit({
    actor: session.user.email,
    action: 'create',
    entity: resource.name,
    entityId: created.id,
    after: result.data,
  })

  return result
}

export async function updateResource<T extends Record<string, unknown>>(
  resource: ResourceConfig<T>,
  delegate: DelegatePrisma<T>,
  entityId: string,
  formData: FormData,
): Promise<ValidationResult<T>> {
  const session = await requireAdmin()
  const result = validateFormData(resource, formData)
  if (!result.success) return result

  const before = await delegate.findUnique({ where: { id: entityId } })
  // Voir le commentaire équivalent dans createResource : même retrait, même raison.
  const dataToWrite = omitSystemFields(result.data, resource.systemFields) as Partial<T>
  const after = await delegate.update({ where: { id: entityId }, data: dataToWrite })
  await recordAudit({
    actor: session.user.email,
    action: 'update',
    entity: resource.name,
    entityId,
    before,
    after,
  })

  return result
}

export async function deleteResource<T extends Record<string, unknown>>(
  resource: ResourceConfig<T>,
  delegate: DelegatePrisma<T>,
  entityId: string,
): Promise<void> {
  const session = await requireAdmin()
  const before = await delegate.findUnique({ where: { id: entityId } })
  await delegate.delete({ where: { id: entityId } })
  await recordAudit({
    actor: session.user.email,
    action: 'delete',
    entity: resource.name,
    entityId,
    before,
  })
}
