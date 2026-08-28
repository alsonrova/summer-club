import type { Prisma } from '@prisma/client'
import type { Statut } from '@/domain/order-status'
import type { CANAUX } from '@/admin/resources/orders'

// Même taille de page que le catalogue : une boutique artisanale, pas une marketplace.
export const COMMANDES_PAR_PAGE = 20

export type Canal = (typeof CANAUX)[number]

export type FiltresCommandes = {
  statut?: Statut
  canal?: Canal
  reference?: string
}

// Ligne telle qu'affichée par <AdminTable>. `id` n'est pas une colonne (il n'est pas dans
// `orderSchema`) mais il est nécessaire à la clé de rendu et au lien vers la fiche — même
// motif que LigneProduitListe.
export type LigneCommandeListe = {
  id: string
  reference: string
  createdAt: Date
  clientNom: string
  tel: string
  canal: Canal
  statut: Statut
  total: number
}

// Sous-ensemble du delegate Prisma réellement utilisé — même esprit que
// DelegateListeProduits : la pagination peut être exercée en test avec un espion, ce qui
// permet d'affirmer que skip/take partent bien vers la base au lieu de vérifier
// indirectement des lignes déjà découpées en mémoire.
export type DelegateListeCommandes = {
  count: (args: { where: Prisma.OrderWhereInput }) => Promise<number>
  findMany: (args: {
    where: Prisma.OrderWhereInput
    orderBy: Prisma.OrderOrderByWithRelationInput[]
    skip: number
    take: number
  }) => Promise<Prisma.OrderGetPayload<object>[]>
}

export async function listerCommandesPaginees(
  delegate: DelegateListeCommandes,
  params: { page: number; filtres?: FiltresCommandes },
): Promise<{ lignes: LigneCommandeListe[]; page: number; totalPages: number; total: number }> {
  const where: Prisma.OrderWhereInput = {}
  if (params.filtres?.statut) where.statut = params.filtres.statut
  if (params.filtres?.canal) where.canal = params.filtres.canal
  if (params.filtres?.reference) {
    // `contains` insensible à la casse : la propriétaire recopie une référence lue sur
    // WhatsApp, souvent partiellement et sans respecter la casse.
    where.reference = { contains: params.filtres.reference, mode: 'insensitive' }
  }

  const total = await delegate.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / COMMANDES_PAR_PAGE))
  const page = Math.min(Math.max(1, Math.trunc(params.page) || 1), totalPages)

  // `createdAt` seul ne suffit PAS comme clé de tri : deux commandes passées dans la même
  // milliseconde (un test, une rafale) partagent la même valeur, et PostgreSQL ne garantit
  // alors aucun ordre stable d'une requête à l'autre — skip/take renverrait deux fois la
  // même ligne sur deux pages et en oublierait une autre. `id` (unique) en second critère
  // rend le tri total, donc déterministe.
  const commandes = await delegate.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * COMMANDES_PAR_PAGE,
    take: COMMANDES_PAR_PAGE,
  })

  const lignes: LigneCommandeListe[] = commandes.map((c) => ({
    id: c.id,
    reference: c.reference,
    createdAt: c.createdAt,
    clientNom: c.clientNom,
    tel: c.tel,
    canal: c.canal,
    statut: c.statut,
    total: c.total,
  }))

  return { lignes, page, totalPages, total }
}
