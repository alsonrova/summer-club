'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthClient } from 'better-auth/react'

// Une session dure sept jours par défaut chez Better Auth : sans ce bouton, rien ne
// permettait d'y mettre fin depuis l'interface.
const authClient = createAuthClient()

export function BoutonDeconnexion() {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function seDeconnecter() {
    setEnCours(true)
    setErreur(null)

    // Ne rediriger qu'en cas de succès : rediriger dans un `finally` mentirait à
    // l'utilisateur en cas d'échec — le cookie de session resterait posé alors que
    // l'interface donnerait l'impression d'une déconnexion effective.
    try {
      const { error } = await authClient.signOut()
      if (error) {
        setErreur('La déconnexion a échoué. Réessayez.')
        setEnCours(false)
        return
      }
      router.push('/connexion')
      router.refresh()
    } catch {
      setErreur('Déconnexion impossible. Vérifiez votre réseau et réessayez.')
      setEnCours(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={seDeconnecter}
        disabled={enCours}
        className="text-small text-bark-soft underline decoration-taupe/60 underline-offset-4 transition-colors hover:text-bark disabled:opacity-60"
      >
        Se déconnecter
      </button>
      {erreur ? (
        <p role="alert" className="text-small mt-1 text-bark">
          {erreur}
        </p>
      ) : null}
    </div>
  )
}
