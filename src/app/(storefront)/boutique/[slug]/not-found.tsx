import Link from 'next/link'

// État d'échec de la fiche : notFound() dans page.tsx aboutit ici, en français et dans le
// layout de la vitrine (en-tête et pied de page conservés), avec le statut HTTP 404. Sans
// ce fichier, la cliente tomberait sur la page d'erreur générique de Next.js, en anglais.
export default function ProductNotFound() {
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
      <h1 className="text-h1 leading-[1.08]">Pièce introuvable</h1>
      <p className="mt-6 max-w-[68ch] leading-[1.7] text-bark-soft">
        Cette pièce n&apos;existe pas ou n&apos;est plus en vente.
      </p>
      <Link
        href="/boutique"
        className="mt-8 inline-block text-bark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
      >
        Retour à la boutique
      </Link>
    </main>
  )
}
