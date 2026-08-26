import { requireAdmin } from '@/server/auth'
import { enregistrerAudit } from '@/server/audit'
import type { ResourceConfig } from '../resource'

export type ErreursValidation = Record<string, string[]>

export type ResultatValidation<T> =
  | { succes: true; donnees: T }
  | { succes: false; erreurs: ErreursValidation }

// Un <form> HTML ne transmet que des chaînes (et l'absence de clé pour une case à cocher
// non cochée). On convertit vers les types attendus par le schéma Zod de la ressource
// avant validation : sans cette étape, un champ `number` resterait une chaîne et
// échouerait systématiquement (z.number() refuse "45000").
export function formDataVersObjet<T>(
  formData: FormData,
  resource: ResourceConfig<T>,
): Record<string, unknown> {
  const objet: Record<string, unknown> = {}

  for (const champ of resource.fields) {
    if (champ.kind === 'boolean') {
      objet[champ.name] = formData.has(champ.name)
      continue
    }

    const valeur = formData.get(champ.name)
    if (valeur === null) continue
    const s = String(valeur)

    if (champ.kind === 'number') {
      objet[champ.name] = s === '' ? undefined : Number(s)
    } else if (champ.kind === 'date') {
      objet[champ.name] = s === '' ? undefined : new Date(s)
    } else {
      objet[champ.name] = s
    }
  }

  return objet
}

// Regroupe les messages d'erreur Zod (déjà en français dans les schémas du domaine) par
// nom de champ, pour que form.tsx puisse les afficher sous chaque entrée.
export function validerFormData<T>(
  resource: ResourceConfig<T>,
  formData: FormData,
): ResultatValidation<T> {
  const brut = formDataVersObjet(formData, resource)
  const analyse = resource.schema.safeParse(brut)

  if (analyse.success) {
    return { succes: true, donnees: analyse.data as T }
  }

  const erreurs: ErreursValidation = {}
  for (const probleme of analyse.error.issues) {
    const cle = probleme.path.length > 0 ? String(probleme.path[0]) : '_racine'
    ;(erreurs[cle] ??= []).push(probleme.message)
  }
  return { succes: false, erreurs }
}

// Sous-ensemble du delegate Prisma généré (ex. `prisma.produit`) dont l'engine a besoin.
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
export async function creerRessource<T extends Record<string, unknown>>(
  resource: ResourceConfig<T>,
  delegate: DelegatePrisma<T>,
  formData: FormData,
): Promise<ResultatValidation<T>> {
  const session = await requireAdmin()
  const resultat = validerFormData(resource, formData)
  if (!resultat.succes) return resultat

  const cree = await delegate.create({ data: resultat.donnees })
  await enregistrerAudit({
    acteur: session.user.email,
    action: 'creer',
    entite: resource.name,
    entiteId: cree.id,
    apres: resultat.donnees,
  })

  return resultat
}

export async function modifierRessource<T extends Record<string, unknown>>(
  resource: ResourceConfig<T>,
  delegate: DelegatePrisma<T>,
  entiteId: string,
  formData: FormData,
): Promise<ResultatValidation<T>> {
  const session = await requireAdmin()
  const resultat = validerFormData(resource, formData)
  if (!resultat.succes) return resultat

  const avant = await delegate.findUnique({ where: { id: entiteId } })
  const apres = await delegate.update({ where: { id: entiteId }, data: resultat.donnees })
  await enregistrerAudit({
    acteur: session.user.email,
    action: 'modifier',
    entite: resource.name,
    entiteId,
    avant,
    apres,
  })

  return resultat
}

export async function supprimerRessource<T extends Record<string, unknown>>(
  resource: ResourceConfig<T>,
  delegate: DelegatePrisma<T>,
  entiteId: string,
): Promise<void> {
  const session = await requireAdmin()
  const avant = await delegate.findUnique({ where: { id: entiteId } })
  await delegate.delete({ where: { id: entiteId } })
  await enregistrerAudit({
    acteur: session.user.email,
    action: 'supprimer',
    entite: resource.name,
    entiteId,
    avant,
  })
}
