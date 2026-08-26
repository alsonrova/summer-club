import Link from 'next/link'
import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import { AdminTable } from '@/admin/engine/table'
import { productsResource } from '@/admin/resources/products'
import { formatAriary } from '@/domain/money'
import { listerProduitsPagines } from './query'

function versPageValide(valeur: string | undefined): number {
  const n = Number(valeur)
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1
}

function versFiltreActif(valeur: string | undefined): boolean | undefined {
  if (valeur === 'true') return true
  if (valeur === 'false') return false
  return undefined
}

// Chaque page d'administration appelle requireAdmin() elle-même : voir le commentaire de
// convention dans src/server/auth.ts — le layout /admin ne suffit pas (rendu partiel, ne
// protège ni les Server Actions ni les Route Handlers).
export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()

  const sp = await searchParams
  const categoryId = typeof sp.categoryId === 'string' && sp.categoryId !== '' ? sp.categoryId : undefined
  const actifBrut = typeof sp.actif === 'string' ? sp.actif : undefined
  const actif = versFiltreActif(actifBrut)
  const page = versPageValide(typeof sp.page === 'string' ? sp.page : undefined)

  const { lignes, page: pageCourante, totalPages } = await listerProduitsPagines(prisma.product, {
    page,
    filtres: { categoryId, actif },
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-light text-bark">Produits</h1>
        <Link
          href="/admin/produits/nouveau"
          className="rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90"
        >
          Nouveau produit
        </Link>
      </div>

      <AdminTable
        resource={productsResource}
        lignes={lignes}
        cheminBase="/admin/produits"
        page={pageCourante}
        totalPages={totalPages}
        filtres={{ categoryId: categoryId ?? '', actif: actifBrut ?? '' }}
        formatColonnes={{ prixBase: (valeur) => formatAriary(Number(valeur)) }}
      />
    </div>
  )
}
