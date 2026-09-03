import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { defineResource } from '@/admin/resource'
import { createResource } from '@/admin/engine/actions'

// createResource passe par requireAdmin() (session, next/headers) et recordAudit()
// (Prisma) : hors du périmètre de ce test, qui ne porte que sur le retrait des champs
// système avant l'appel au delegate. On les remplace par de simples doublures — vi.mock
// est hissé par vitest au-dessus des imports ci-dessus, donc actions.ts reçoit bien ces
// doublures au chargement.
vi.mock('@/server/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { email: 'admin@test.dev' } }),
}))
vi.mock('@/server/audit', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('champs système (id, createdAt, updatedAt)', () => {
  it("un schéma contenant 'id' ne produit pas de champ de formulaire 'id'", () => {
    const schema = z.object({ id: z.string().optional(), name: z.string().min(1) })
    const resource = defineResource({ name: 'test', label: 'Test', schema, columns: ['name'] })
    expect(resource.fields.map((f) => f.name)).toEqual(['name'])
  })

  it("createResource ne transmet pas 'id' au delegate, même si le schéma lui donne une valeur par défaut", async () => {
    const schema = z.object({
      id: z.string().default('id-par-defaut-du-schema'),
      name: z.string().min(1),
    })
    const resource = defineResource({ name: 'test', label: 'Test', schema, columns: ['name'] })

    const formData = new FormData()
    formData.set('name', 'Bracelet')

    let receivedData: Record<string, unknown> | undefined
    const delegate = {
      findUnique: vi.fn(),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        receivedData = data
        return { ...data, id: 'id-genere-par-prisma' } as never
      }),
      update: vi.fn(),
      delete: vi.fn(),
    }

    await createResource(resource as never, delegate as never, formData)

    expect(receivedData).toBeDefined()
    expect(receivedData).not.toHaveProperty('id')
    expect(receivedData).toEqual({ name: 'Bracelet' })
  })
})
