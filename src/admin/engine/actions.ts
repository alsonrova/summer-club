import { requireAdmin } from '@/server/auth'
import { recordAudit } from '@/server/audit'
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

// Retire les champs système (id, createdAt, updatedAt par défaut — voir
// CHAMPS_SYSTEME_PAR_DEFAUT dans resource.ts) des données validées, juste avant
// l'écriture Prisma. Nécessaire même si formDataVersObjet ne les collecte déjà plus
// depuis le FormData (ils sont absents de resource.fields) : un schéma peut leur donner
// une valeur par défaut (`z.string().default(...)`), que Zod applique alors aux données
// analysées malgré leur absence du formulaire soumis — sans ce retrait, cette valeur par
// défaut (ou un id forgé si le schéma ne le rend pas optionnel) partirait telle quelle
// vers `delegate.create`/`delegate.update`.
function omettreChampsSysteme(
  donnees: Record<string, unknown>,
  champsSysteme: string[],
): Record<string, unknown> {
  const copie = { ...donnees }
  for (const champ of champsSysteme) {
    delete copie[champ]
  }
  return copie
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

  // Le cast vers T est sûr : `donneesAEcrire` est `resultat.donnees` privé des seules
  // clés listées dans `resource.champsSysteme`, et le delegate Prisma réel génère ces
  // colonnes lui-même (id, createdAt, updatedAt) — il ne les exige jamais en écriture.
  const donneesAEcrire = omettreChampsSysteme(resultat.donnees, resource.champsSysteme) as T
  const cree = await delegate.create({ data: donneesAEcrire })
  await recordAudit({
    actor: session.user.email,
    action: 'creer',
    entity: resource.name,
    entityId: cree.id,
    after: resultat.donnees,
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
  // Voir le commentaire équivalent dans creerRessource : même retrait, même raison.
  const donneesAEcrire = omettreChampsSysteme(resultat.donnees, resource.champsSysteme) as Partial<T>
  const apres = await delegate.update({ where: { id: entiteId }, data: donneesAEcrire })
  await recordAudit({
    actor: session.user.email,
    action: 'modifier',
    entity: resource.name,
    entityId: entiteId,
    before: avant,
    after: apres,
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
  await recordAudit({
    actor: session.user.email,
    action: 'supprimer',
    entity: resource.name,
    entityId: entiteId,
    before: avant,
  })
}
