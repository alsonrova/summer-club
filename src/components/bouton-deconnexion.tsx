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

  async function seDeconnecter() {
    setEnCours(true)
    try {
      await authClient.signOut()
    } finally {
      router.push('/connexion')
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      onClick={seDeconnecter}
      disabled={enCours}
      className="text-small text-bark-soft underline decoration-taupe/60 underline-offset-4 transition-colors hover:text-bark disabled:opacity-60"
    >
      Se déconnecter
    </button>
  )
}
