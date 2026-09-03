import { notFound } from 'next/navigation'
import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import { formatAriary } from '@/domain/money'
import {
  updateProduct,
  adjustStock,
  uploadMedia,
  reorderMedia,
  createVariant,
  updateMediaAlt,
  setPrimaryPhoto,
  deleteMedia,
} from '../actions'
import { initialProductFormState } from '../states'
import { ProductForm } from '../product-form'
import { StockForm } from './stock-form'
import { MediaForm } from './media-form'
import { VariantForm } from './variant-form'
import { MediaCard } from './media-card'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { libelle: 'asc' } },
        media: { orderBy: { position: 'asc' } },
      },
    }),
    prisma.category.findMany({ orderBy: { ordre: 'asc' }, select: { id: true, nom: true } }),
  ])

  if (!product) notFound()

  const updateThisProduct = updateProduct.bind(null, product.id)
  const uploadForThisProduct = uploadMedia.bind(null, product.id)
  const createVariantForThisProduct = createVariant.bind(null, product.id)

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-6 font-display text-2xl font-light text-bark">{product.nom}</h1>
        <ProductForm
          action={updateThisProduct}
          initialState={{ ...initialProductFormState, initialValues: product }}
          categories={categories}
          submitLabel="Enregistrer"
        />
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Déclinaisons</h2>
        {product.variants.length === 0 ? (
          <p className="text-bark-soft">Aucune déclinaison pour ce produit.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-taupe/40">
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Déclinaison</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">SKU</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Prix</th>
                <th className="px-3 py-2 text-small font-medium text-bark-soft">Stock</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr key={variant.id} className="border-b border-taupe/40">
                  <td className="px-3 py-2 text-bark">{variant.libelle}</td>
                  <td className="px-3 py-2 text-bark">{variant.sku}</td>
                  <td className="px-3 py-2 text-bark tabular-nums">
                    {formatAriary(product.prixBase + variant.deltaPrix)}
                  </td>
                  <td className="px-3 py-2">
                    <StockForm
                      action={adjustStock.bind(null, variant.id)}
                      currentStock={variant.stock}
                      lowStockThreshold={variant.seuilAlerte}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <VariantForm action={createVariantForThisProduct} basePrice={product.prixBase} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Photos</h2>
        <p className="mb-4 text-small text-bark-soft">
          {/* Fichier statique servi depuis public/, pas une route Next.js : une balise
              <a> ordinaire, pas <Link> (que typedRoutes limiterait aux routes connues). */}
          <a href="/guide-photo.md" target="_blank" rel="noreferrer" className="underline">
            Consulter le guide de prise de vue
          </a>{' '}
          avant de photographier — le traitement automatique corrige le cadrage, pas la
          lumière.
        </p>

        {product.media.length > 0 ? (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {product.media.map((media) => (
              <MediaCard
                key={media.id}
                media={media}
                reorderAction={reorderMedia.bind(null, media.id)}
                altAction={updateMediaAlt.bind(null, media.id)}
                primaryAction={setPrimaryPhoto.bind(null, media.id)}
                deleteAction={deleteMedia.bind(null, media.id)}
              />
            ))}
          </div>
        ) : (
          <p className="mb-6 text-bark-soft">Aucune photo pour ce produit.</p>
        )}

        <MediaForm action={uploadForThisProduct} />
      </section>
    </div>
  )
}
