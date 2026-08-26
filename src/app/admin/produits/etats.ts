import type { ErreursValidation } from '@/admin/engine/actions'

// Séparé de actions.ts : un fichier marqué 'use server' ne peut exporter que des fonctions
// async (voir https://nextjs.org/docs/messages/invalid-use-server-value, rencontré en
// tentant d'y exporter ces constantes directement) — ces types et leurs valeurs initiales
// sont pourtant nécessaires aussi bien aux Server Actions (comme forme de retour) qu'aux
// composants client qui les invoquent via useActionState (comme état initial).

export type EtatFormulaireProduit = {
  succes: boolean
  erreurs: ErreursValidation
  valeursInitiales: Record<string, unknown>
}

export const etatFormulaireProduitInitial: EtatFormulaireProduit = {
  succes: false,
  erreurs: {},
  valeursInitiales: {},
}

export type EtatActionSimple = {
  erreur: string | null
}

export const etatActionSimpleInitial: EtatActionSimple = { erreur: null }
