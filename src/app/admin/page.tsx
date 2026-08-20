// Coquille minimale du tableau de bord : la tâche 9 ne livre que l'authentification et
// la protection du back-office, pas le contenu de l'administration (tâches suivantes).
export default function AdminPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-light text-bark">Tableau de bord</h1>
      <p className="mt-2 text-bark-soft">
        Le contenu de l&apos;administration sera ajouté dans une tâche ultérieure.
      </p>
    </div>
  )
}
