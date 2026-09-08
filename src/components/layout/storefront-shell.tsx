import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

// Coque de la vitrine : en-tête collant, contenu qui pousse le pied de page en bas de
// l'écran, pied de page. Partagée par le layout du groupe (storefront) et par la page 404
// racine (src/app/not-found.tsx), qui vit hors de ce groupe — donc hors de son layout — et
// doit pourtant garder la cliente dans la vitrine. Deux appelants, un seul endroit où la
// structure peut changer : c'est le cas que src/components/ sert (docs/CONVENTIONS.md § 2).
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
