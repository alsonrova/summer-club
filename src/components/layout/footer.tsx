// Contrat minimal (YAGNI) : pied de page sur `--bark`, texte clair, marque et mention
// légale. Rien de plus tant que les écrans qui l'entourent (tâches 14-15) n'existent
// pas encore.
export function Footer() {
  return (
    <footer className="bg-bark text-shell">
      <div className="mx-auto max-w-[1200px] px-6 py-12 md:px-10">
        <p className="font-display text-lg font-normal">Summer Club</p>
        <p className="mt-2 text-small text-shell/70">
          Bijoux solaires en acier inoxydable plaqué or 18k, pensés pour Madagascar.
        </p>
        <p className="mt-6 text-small text-shell/50">© 2026 Summer Club</p>
      </div>
    </footer>
  )
}
