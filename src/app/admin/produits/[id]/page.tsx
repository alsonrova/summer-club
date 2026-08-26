import { notFound } from 'next/navigation'
import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import { formatAriary } from '@/domain/money'
import {
  modifierProduit,
  ajusterStock,
  televerserMedia,
  reordonnerMedia,
  creerDeclinaison,
  modifierAltMedia,
  definirPhotoPrincipale,
  supprimerMedia,
} from '../actions'
import { etatFormulaireProduitInitial } from '../etats'
import { FormulaireProduit } from '../formulaire-produit'
import { FormulaireStock } from './formulaire-stock'
import { FormulaireMedia } from './formulaire-media'
import { FormulaireDeclinaison } from './formulaire-declinaison'
import { MediaCarte } from './media-carte'

export default async function FicheProduitPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const [produit, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { libelle: 'asc' } },
        media: { orderBy: { position: 'asc' } },
      },
    }),
    prisma.category.findMany({ orderBy: { ordre: 'asc' }, select: { id: true, nom: true } }),
  ])

  if (!produit) notFound()

  const modifierCeProduit = modifierProduit.bind(null, produit.id)
  const televerserPourCeProduit = televerserMedia.bind(null, produit.id)
  const creerDeclinaisonPourCeProduit = creerDeclinaison.bind(null, produit.id)

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-6 font-display text-2xl font-light text-bark">{produit.nom}</h1>
        <FormulaireProduit
          action={modifierCeProduit}
          etatInitial={{ ...etatFormulaireProduitInitial, valeursInitiales: produit }}
          categories={categories}
          libelleSoumettre="Enregistrer"
        />
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-light text-bark">Déclinaisons</h2>
        {produit.variants.length === 0 ? (
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
              {produit.variants.map((variant) => (
                <tr key={variant.id} className="border-b border-taupe/40">
                  <td className="px-3 py-2 text-bark">{variant.libelle}</td>
                  <td className="px-3 py-2 text-bark">{variant.sku}</td>
                  <td className="px-3 py-2 text-bark tabular-nums">
                    {formatAriary(produit.prixBase + variant.deltaPrix)}
                  </td>
                  <td className="px-3 py-2">
                    <FormulaireStock
                      action={ajusterStock.bind(null, variant.id)}
                      stockActuel={variant.stock}
                      seuilAlerte={variant.seuilAlerte}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <FormulaireDeclinaison action={creerDeclinaisonPourCeProduit} prixBase={produit.prixBase} />
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

        {produit.media.length > 0 ? (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {produit.media.map((media) => (
              <MediaCarte
                key={media.id}
                media={media}
                actionReordonner={reordonnerMedia.bind(null, media.id)}
                actionAlt={modifierAltMedia.bind(null, media.id)}
                actionPrincipale={definirPhotoPrincipale.bind(null, media.id)}
                actionSupprimer={supprimerMedia.bind(null, media.id)}
              />
            ))}
          </div>
        ) : (
          <p className="mb-6 text-bark-soft">Aucune photo pour ce produit.</p>
        )}

        <FormulaireMedia action={televerserPourCeProduit} />
      </section>
    </div>
  )
}
