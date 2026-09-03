import type { Route } from 'next'
import Link from 'next/link'

// Contrat volontairement minimal (YAGNI) : le tiroir panier arrive à la tâche 16, les
// routes /boutique et /panier aux tâches 14-15. L'en-tête collant reste sur `--shell`
// avec la SEULE ombre autorisée par la charte (spec § 3.5) : `0 1px 0
// rgba(185,169,146,.35)`, jamais une ombre portée générique.
//
// `typedRoutes` (next.config.ts) valide chaque `href` littéral contre les routes qui
// existent réellement sous src/app/ (.next/types/routes.d.ts) : /boutique et /panier
// n'y figurent pas encore, d'où le `as Route` — le remède documenté par Next.js pour
// un lien vers une route non encore statiquement connue (node_modules/next/dist/docs/
// .../02-typescript.md, § « Statically Typed Links »). À retirer quand les tâches
// 14-15 auront créé ces routes.
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
            href={'/boutique' as Route}
            className="text-bark-soft transition-colors hover:text-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
          >
            Boutique
          </Link>
          <Link
            href={'/panier' as Route}
            className="text-bark-soft transition-colors hover:text-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
          >
            Panier
          </Link>
        </nav>
      </div>
    </header>
  )
}
