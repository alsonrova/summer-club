import Link from 'next/link'
import { requireAdmin } from '@/server/auth'
import { SignOutButton } from '@/components/bouton-deconnexion'

// Layout unique de tout /admin/* : la page de connexion vit hors de /admin (voir
// src/app/connexion/page.tsx), donc requireAdmin() peut être appelé ici sans provoquer de
// boucle de redirection. Toute route ajoutée sous /admin est protégée par construction.
//
// Défense en profondeur : un layout ne re-rend pas à chaque navigation (rendu partiel) et
// ne protège ni les Server Actions ni le reste de la route — voir le commentaire dans
// src/server/auth.ts. Les pages et Server Actions d'administration appellent donc aussi
// requireAdmin() elles-mêmes.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="min-h-screen bg-sand">
      <nav className="flex items-center justify-between border-b border-taupe/40 bg-shell px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="font-display text-lg font-light text-bark">
            Summer Club — administration
          </span>
          <Link href="/admin/produits" className="text-bark-soft hover:text-bark">
            Produits
          </Link>
          <Link href="/admin/commandes" className="text-bark-soft hover:text-bark">
            Commandes
          </Link>
          <Link href="/admin/avis" className="text-bark-soft hover:text-bark">
            Avis
          </Link>
        </div>
        <SignOutButton />
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
