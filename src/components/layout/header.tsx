import Link from 'next/link'

// Contrat volontairement minimal (YAGNI) : la marque et le lien vers la boutique. Le tiroir
// panier, la route /panier et le lien « Panier » de cet en-tête arrivent ensemble à la
// tâche 16 « Panier persistant » (plan, src/app/(storefront)/panier/page.tsx). Ce lien
// existait avant sa route : constat du testeur UX/UI (tâche 14), il menait à la 404
// générique de Next.js, en anglais, sans en-tête ni pied de page, et son préchargement
// journalisait quatre erreurs 404 dans la console de chaque fiche. Un lien mort est un
// défaut, pas une promesse — même raisonnement que le bouton « Ajouter au panier » absent
// de VariantPicker. Avec lui disparaît le cast `as Route` qu'il imposait (`typedRoutes`,
// next.config.ts, refuse un href littéral vers une route absente de
// .next/types/routes.d.ts) : la tâche 16 créera la route avant de rendre le lien, et n'en
// aura pas besoin. tests/components/header.test.tsx garde la liste des adresses visées.
//
// L'en-tête collant reste sur `--shell` avec la SEULE ombre autorisée par la charte
// (spec § 3.5) : `0 1px 0 rgba(185,169,146,.35)`, jamais une ombre portée générique.
export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-shell shadow-[0_1px_0_rgba(185,169,146,0.35)]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="/"
          className="font-display text-lg font-normal text-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
        >
          Summer Club
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center gap-6 text-small">
          <Link
            href="/boutique"
            className="text-bark-soft transition-colors hover:text-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
          >
            Boutique
          </Link>
        </nav>
      </div>
    </header>
  )
}
