// Séparé de actions.ts : un fichier marqué 'use server' ne peut exporter que des fonctions
// async (https://nextjs.org/docs/messages/invalid-use-server-value). Même découpage que
// src/app/admin/produits/etats.ts.

export type EtatChangementStatut = {
  erreur: string | null
}

export const etatChangementStatutInitial: EtatChangementStatut = { erreur: null }
