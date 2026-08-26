import { requireAdmin } from '@/server/auth'

// Coquille minimale du tableau de bord : la tâche 9 ne livre que l'authentification et
// la protection du back-office, pas le contenu de l'administration (tâches suivantes).
//
// Le layout (src/app/admin/layout.tsx) appelle déjà requireAdmin(), mais un layout ne
// protège pas le reste de la route en cas de rendu partiel (voir le commentaire dans
// src/server/auth.ts). Convention : toute page d'administration appelle requireAdmin()
// elle-même ; l'appel ici est mis en cache via React `cache()`, donc ce doublon ne
// déclenche pas une seconde vérification de session.
export default async function AdminPage() {
  await requireAdmin()

  return (
    <div>
      <h1 className="font-display text-2xl font-light text-bark">Tableau de bord</h1>
      <p className="mt-2 text-bark-soft">
        Le contenu de l&apos;administration sera ajouté dans une tâche ultérieure.
      </p>
    </div>
  )
}
