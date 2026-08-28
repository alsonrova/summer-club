import type { ErreursValidation } from '@/admin/engine/actions'

// Séparé de actions.ts : un fichier marqué 'use server' ne peut exporter que des fonctions
// async (https://nextjs.org/docs/messages/invalid-use-server-value).

export type EtatFormulaireTemoignage = {
  succes: boolean
  erreurs: ErreursValidation
  valeursInitiales: Record<string, unknown>
}

export const etatFormulaireTemoignageInitial: EtatFormulaireTemoignage = {
  succes: false,
  erreurs: {},
  valeursInitiales: {},
}

export type EtatActionAvis = {
  erreur: string | null
}

export const etatActionAvisInitial: EtatActionAvis = { erreur: null }
