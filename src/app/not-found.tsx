import Link from 'next/link'
import { StorefrontShell } from '@/components/layout/storefront-shell'

// Page 404 racine : toute adresse sans correspondance sous src/app/ aboutit ici, avec le
// statut HTTP 404 (doc Next installée, node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/not-found.md : « the root app/not-found.js … handle any unmatched
// URLs for your whole application »). Constat du testeur UX/UI (tâche 14) : sans ce fichier,
// une adresse inconnue hors de /boutique — /panier avant la tâche 16, une faute de frappe,
// un vieux lien — tombait sur la 404 générique de Next.js : titre d'onglet et texte en
// anglais, sans en-tête ni pied de page, sans lien de retour.
//
// Ce fichier vit hors du groupe (storefront), donc hors de son layout : il monte la coque
// de la vitrine lui-même. Un `not-found.tsx` ne peut pas exporter de `metadata` (seul le
// `global-not-found.js` expérimental le peut, même doc) : le titre d'onglet vient du titre
// par défaut posé par src/app/layout.tsx. La fiche introuvable garde son propre état
// d'échec, plus précis (src/app/(storefront)/boutique/[slug]/not-found.tsx).
export default function NotFound() {
  return (
    <StorefrontShell>
      <main className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
        <h1 className="text-h1 leading-[1.08]">Page introuvable</h1>
        <p className="mt-6 max-w-[68ch] leading-[1.7] text-bark-soft">
          Cette adresse ne mène nulle part. Elle a peut-être changé, ou n&apos;a jamais existé.
        </p>
        <Link
          href="/boutique"
          className="mt-8 inline-block text-bark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
        >
          Retour à la boutique
        </Link>
      </main>
    </StorefrontShell>
  )
}
