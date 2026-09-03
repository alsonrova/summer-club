import { SignOutButton } from '@/components/sign-out-button'

// Atteinte par requireAdmin() quand une session valide n'a pas le rôle `admin` (ex. un
// compte `member`). Volontairement distincte de /connexion : rediriger un utilisateur déjà
// authentifié vers un formulaire de connexion produirait un va-et-vient sans fin.
//
// `forbidden()` de Next.js aurait été l'option idiomatique, mais elle nécessite le drapeau
// expérimental `experimental.authInterrupts` (voir node_modules/next/dist/docs/01-app/
// 03-api-reference/04-functions/forbidden.md) : on reste donc sur cette page dédiée.
export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-6">
      <div className="w-full max-w-sm rounded-lg border border-taupe/40 bg-shell p-8 text-center">
        <h1 className="mb-3 font-display text-2xl font-light text-bark">Accès réservé</h1>
        <p className="mb-6 text-small text-bark-soft">
          Cette section est réservée aux administrateurs. Votre compte ne dispose pas des
          droits nécessaires.
        </p>
        <SignOutButton />
      </div>
    </div>
  )
}
