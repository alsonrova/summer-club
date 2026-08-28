import type { Prisma, SourceAvis, StatutAvis } from '@prisma/client'

export const AVIS_PAR_PAGE = 20

export const STATUTS_AVIS = ['en_attente', 'publie', 'rejete'] as const satisfies readonly StatutAvis[]

export const LIBELLES_STATUT_AVIS = {
  en_attente: 'En attente',
  publie: 'Publié',
  rejete: 'Rejeté',
} as const satisfies Record<StatutAvis, string>

export const LIBELLES_SOURCE_AVIS = {
  verifie: 'Achat vérifié',
  importe: 'Importé',
} as const satisfies Record<SourceAvis, string>

export type FiltresAvis = {
  statut?: StatutAvis
  epingle?: boolean
}

export type LigneAvisListe = {
  id: string
  auteur: string
  note: number
  texte: string
  source: SourceAvis
  statut: StatutAvis
  epingle: boolean
  createdAt: Date
  produit: string | null
}

// Même motif que DelegateListeProduits/DelegateListeCommandes : le sous-ensemble du
// delegate Prisma réellement utilisé, pour que la pagination soit vérifiable en test.
export type DelegateListeAvis = {
  count: (args: { where: Prisma.ReviewWhereInput }) => Promise<number>
  findMany: (args: {
    where: Prisma.ReviewWhereInput
    orderBy: Prisma.ReviewOrderByWithRelationInput[]
    skip: number
    take: number
    include: { product: { select: { nom: true } } }
  }) => Promise<Prisma.ReviewGetPayload<{ include: { product: { select: { nom: true } } } }>[]>
}

export async function listerAvisPagines(
  delegate: DelegateListeAvis,
  params: { page: number; filtres?: FiltresAvis },
): Promise<{ lignes: LigneAvisListe[]; page: number; totalPages: number; total: number }> {
  const where: Prisma.ReviewWhereInput = {}
  if (params.filtres?.statut) where.statut = params.filtres.statut
  if (params.filtres?.epingle !== undefined) where.epingle = params.filtres.epingle

  const total = await delegate.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / AVIS_PAR_PAGE))
  const page = Math.min(Math.max(1, Math.trunc(params.page) || 1), totalPages)

  // Les avis épinglés d'abord (c'est ce que la propriétaire vient vérifier), puis les plus
  // récents. `id` en dernier critère : sans clé unique finale, deux avis créés dans la même
  // milliseconde peuvent changer d'ordre entre deux requêtes, et skip/take dupliquer une
  // ligne d'une page à l'autre.
  const avis = await delegate.findMany({
    where,
    orderBy: [{ epingle: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * AVIS_PAR_PAGE,
    take: AVIS_PAR_PAGE,
    include: { product: { select: { nom: true } } },
  })

  const lignes: LigneAvisListe[] = avis.map((a) => ({
    id: a.id,
    auteur: a.auteur,
    note: a.note,
    texte: a.texte,
    source: a.source,
    statut: a.statut,
    epingle: a.epingle,
    createdAt: a.createdAt,
    produit: a.product?.nom ?? null,
  }))

  return { lignes, page, totalPages, total }
}
