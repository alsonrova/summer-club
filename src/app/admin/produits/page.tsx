import Link from 'next/link'
import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import { AdminTable } from '@/admin/engine/table'
import { productsResource } from '@/admin/resources/products'
import { formatAriary } from '@/domain/money'
import { listProductsPaginated } from './query'

function toValidPage(value: string | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1
}

function toActiveFilter(value: string | undefined): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

// Chaque page d'administration appelle requireAdmin() elle-même : voir le commentaire de
// convention dans src/server/auth.ts — le layout /admin ne suffit pas (rendu partiel, ne
// protège ni les Server Actions ni les Route Handlers).
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()

  const sp = await searchParams
  const categoryId = typeof sp.categoryId === 'string' && sp.categoryId !== '' ? sp.categoryId : undefined
  const rawActive = typeof sp.actif === 'string' ? sp.actif : undefined
  const active = toActiveFilter(rawActive)
  const page = toValidPage(typeof sp.page === 'string' ? sp.page : undefined)

  const { rows, page: currentPage, totalPages } = await listProductsPaginated(prisma.product, {
    page,
    filters: { categoryId, active },
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
        rows={rows}
        basePath="/admin/produits"
        page={currentPage}
        totalPages={totalPages}
        filters={{ categoryId: categoryId ?? '', actif: rawActive ?? '' }}
        columnFormatters={{ prixBase: (value) => formatAriary(Number(value)) }}
        // `row['id']` en notation crochet, pas `row.id` : le paramètre générique T
        // d'AdminTable (ici ProductInput, dérivé de productSchema) n'a pas de champ `id`
        // propre — seule la contrainte structurelle `T extends Record<string, unknown>`
        // autorise l'indexation par une chaîne arbitraire. Le tableau réellement transmis
        // (ProductListRow) porte bien un `id` à l'exécution.
        link={{ column: 'nom', to: (row) => `/admin/produits/${row['id']}` }}
      />
    </div>
  )
}
