/**
 * Coquille commune à tout /admin, connexion comprise.
 * Elle ne vérifie AUCUNE session : la page de connexion en dépend, et un
 * garde posé ici la ferait se rediriger vers elle-même en boucle infinie.
 * La protection vit dans le groupe (protege).
 */
export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-sand">{children}</div>
}
