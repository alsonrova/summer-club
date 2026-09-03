import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/server/db'

let variantId: string

beforeAll(async () => {
  const cat = await prisma.category.create({ data: { slug: 'test-cat', name: 'Test' } })
  const p = await prisma.product.create({
    data: { slug: 'test-prod', name: 'Test', description: 'x', categoryId: cat.id, basePrice: 10000 },
  })
  const v = await prisma.variant.create({
    data: { productId: p.id, label: 'unique', sku: 'TEST-1', stock: 1 },
  })
  variantId = v.id
})

afterAll(async () => {
  await prisma.variant.deleteMany({ where: { sku: 'TEST-1' } })
  await prisma.product.deleteMany({ where: { slug: 'test-prod' } })
  await prisma.category.deleteMany({ where: { slug: 'test-cat' } })
  await prisma.$disconnect()
})

describe('contrainte de stock', () => {
  it('refuse un stock négatif au niveau de la base', async () => {
    await expect(
      prisma.variant.update({ where: { id: variantId }, data: { stock: -1 } }),
    ).rejects.toThrow()
  })
})
