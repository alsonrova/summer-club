import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listActiveProductSlugs, loadProduct } from '@/server/products'
import { Gallery } from '@/components/product/gallery'
import { VariantPicker } from '@/components/product/variant-picker'
import { productJsonLd } from './structured-data'

// Rendu statique revalidé toutes les cinq minutes (spec § 4.3), et à la demande par toute
// action du back-office ou changement de statut de commande qui touche un produit — elles
// invalident le gabarit de cette page (`/(storefront)/boutique/[slug]`, type 'page', groupe
// de routes compris) via productPathsToRevalidate (src/server/products.ts), sans quoi un
// lien déjà partagé servirait une fiche périmée jusqu'à cinq minutes. Mesuré sur le build
// de production avant l'ajout de
// generateStaticParams : sans liste de slugs, Next.js 16.3 rendait cette route
// dynamiquement à chaque requête (aucun en-tête x-nextjs-cache), le `revalidate` restant
// lettre morte. C'est generateStaticParams qui active l'ISR sur un segment dynamique
// (node_modules/next/dist/docs/01-app/02-guides/incremental-static-regeneration.md) : les
// fiches actives sont pré-rendues au build, et un slug absent de la liste — produit créé
// depuis — est rendu à sa première visite puis mis en cache (`dynamicParams`, valeur par
// défaut). Revers connu : un slug inconnu est lui aussi rendu (404) puis écrit dans le
// cache disque, sans éviction — voir la dette « cache ISR des fiches inconnues » de la
// passation (tâche 22, limitation de débit au reverse proxy).
export const revalidate = 300

export async function generateStaticParams() {
  return (await listActiveProductSlugs()).map((slug) => ({ slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await loadProduct((await params).slug)
  if (!product) return {}
  return { title: product.metaTitle, description: product.metaDescription }
}

export default async function ProductPage({ params }: Props) {
  const product = await loadProduct((await params).slug)
  if (!product) notFound()

  return (
    <main className="mx-auto grid max-w-[1200px] gap-12 px-6 py-24 md:grid-cols-2 md:px-10 md:py-40">
      {/* Balise <script> native, pas next/script : ce sont des données, pas du code à
          exécuter (json-ld.md, Next.js). La sérialisation neutralise toute fermeture de
          balise — voir structured-data.ts. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd(product) }} />
      <Gallery images={product.images} />
      <div>
        <h1 className="text-h1 leading-[1.08]">{product.name}</h1>
        <p className="mt-6 max-w-[68ch] leading-[1.7] text-bark-soft">{product.description}</p>
        {/* Seuls les champs que le composant lit : ce qui est passé à un composant client
            part dans la charge RSC de la page, et description, photos et métadonnées y
            figuraient une seconde fois. */}
        <VariantPicker
          product={{
            variants: product.variants,
            finalPrice: product.finalPrice,
            initialPrice: product.initialPrice,
          }}
        />
      </div>
    </main>
  )
}
