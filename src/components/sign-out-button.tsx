'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthClient } from 'better-auth/react'

// Une session dure sept jours par défaut chez Better Auth : sans ce bouton, rien ne
// permettait d'y mettre fin depuis l'interface.
const authClient = createAuthClient()

export function SignOutButton() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignOut() {
    setIsPending(true)
    setError(null)

    // Ne rediriger qu'en cas de succès : rediriger dans un `finally` mentirait à
    // l'utilisateur en cas d'échec — le cookie de session resterait posé alors que
    // l'interface donnerait l'impression d'une déconnexion effective.
    try {
      const { error: signOutError } = await authClient.signOut()
      if (signOutError) {
        setError('La déconnexion a échoué. Réessayez.')
        setIsPending(false)
        return
      }
      router.push('/connexion')
      router.refresh()
    } catch {
      setError('Déconnexion impossible. Vérifiez votre réseau et réessayez.')
      setIsPending(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
        className="text-small text-bark-soft underline decoration-taupe/60 underline-offset-4 transition-colors hover:text-bark disabled:opacity-60"
      >
        Se déconnecter
      </button>
      {error ? (
        <p role="alert" className="text-small mt-1 text-bark">
          {error}
        </p>
      ) : null}
    </div>
  )
}
