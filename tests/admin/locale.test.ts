import { describe, it, expect } from 'vitest'
import { z } from 'zod'
// Importé pour son effet de bord : resource.ts appelle z.config(fr()) au chargement du
// module. C'est ce chargement qu'on vérifie ici — pas d'API publique dédiée.
import '@/admin/resource'

describe('locale zod (interface en français)', () => {
  it('un message de validation par défaut (string min) est en français', () => {
    const result = z.string().min(1).safeParse('')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Trop petit : chaîne doit avoir >=1 caractères',
    )
  })

  it('un message de validation par défaut (number) est en français', () => {
    const result = z.number().int().positive().safeParse(undefined)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Entrée invalide : nombre attendu, indéfini reçu',
    )
  })

  it("un message personnalisé fourni par le schéma reste prioritaire sur la locale", () => {
    const result = z.string().min(2, 'Le nom est requis').safeParse('a')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Le nom est requis')
  })
})
