import { StorefrontShell } from '@/components/layout/storefront-shell'

// Groupe de routes de la vitrine. Son nom n'apparaît dans aucune URL (docs/CONVENTIONS.md
// § 1, cas 1) : il ne sert qu'à poser l'en-tête et le pied de page communs aux pages
// publiques, via StorefrontShell — que la page 404 racine (src/app/not-found.tsx, hors de
// ce groupe) monte elle-même. Aucune garde ici, à dessein — ces pages sont publiques ;
// c'est le groupe admin qui protège les siennes. `lang`, les polices et le titre d'onglet
// par défaut sont posés par src/app/layout.tsx.
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <StorefrontShell>{children}</StorefrontShell>
}
