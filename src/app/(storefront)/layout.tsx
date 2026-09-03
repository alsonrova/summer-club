import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

// Groupe de routes de la vitrine. Son nom n'apparaît dans aucune URL (docs/CONVENTIONS.md
// § 1, cas 1) : il ne sert qu'à poser l'en-tête et le pied de page communs aux pages
// publiques. Aucune garde ici, à dessein — ces pages sont publiques ; c'est le groupe
// admin qui protège les siennes. `lang` et les polices sont posés par src/app/layout.tsx.
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
