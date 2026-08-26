'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthClient } from 'better-auth/react'

// Client Better Auth minimal : une requête `fetch` réelle vers l'API
// (/api/auth/sign-in/email) est nécessaire pour que la limitation de débit du serveur
// s'applique (elle est branchée sur la requête HTTP entrante, pas sur un appel direct à
// `auth.api.signInEmail` fait depuis une Server Action).
const authClient = createAuthClient()

export default function ConnexionPage() {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function seConnecter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErreur(null)
    setEnCours(true)

    const donnees = new FormData(event.currentTarget)
    const email = String(donnees.get('email') ?? '')
    const motDePasse = String(donnees.get('motDePasse') ?? '')

    try {
      const { error } = await authClient.signIn.email({ email, password: motDePasse })

      if (error) {
        // Le message générique ci-dessous est volontaire pour les identifiants : il ne
        // faut pas révéler si un compte existe. Le dépassement de limitation de débit
        // (429) est une cause différente et ne divulgue rien à distinguer explicitement —
        // sans quoi l'utilisateur re-tente aussitôt et se re-bloque, sans comprendre.
        setErreur(
          error.status === 429
            ? 'Trop de tentatives. Réessayez dans quelques instants.'
            : 'Adresse e-mail ou mot de passe incorrect.',
        )
        setEnCours(false)
        return
      }

      router.push('/admin')
      router.refresh()
    } catch {
      // Une exception réseau (serveur injoignable, etc.) ne doit pas laisser le bouton
      // désactivé indéfiniment sans le moindre message.
      setErreur('Connexion impossible. Vérifiez votre réseau et réessayez.')
      setEnCours(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-6">
      <div className="w-full max-w-sm rounded-lg border border-taupe/40 bg-shell p-8">
        <h1 className="mb-6 font-display text-2xl font-light text-bark">
          Administration
        </h1>
        <form onSubmit={seConnecter} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-small text-bark">
              Adresse e-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark outline-none focus:border-sage-deep"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="motDePasse" className="text-small text-bark">
              Mot de passe
            </label>
            <input
              id="motDePasse"
              name="motDePasse"
              type="password"
              autoComplete="current-password"
              required
              minLength={12}
              className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark outline-none focus:border-sage-deep"
            />
          </div>
          {erreur ? (
            <p role="alert" className="text-small text-bark">
              {erreur}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={enCours}
            className="mt-2 rounded bg-sage-deep px-4 py-2 text-shell disabled:opacity-60"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  )
}
