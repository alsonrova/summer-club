import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/server/db'
import { creerCommande, RuptureStockError } from '@/server/orders'

async function variantTest(stock: number) {
  const v = await prisma.variant.findUniqueOrThrow({ where: { sku: 'VAH-45' } })
  await prisma.variant.update({ where: { id: v.id }, data: { stock } })
  return v.id
}

const client = { nom: 'Test', tel: '0320000000' }

beforeEach(async () => {
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
})

afterAll(() => prisma.$disconnect())

describe('creerCommande', () => {
  it('crée la commande et décrémente le stock', async () => {
    const variantId = await variantTest(5)
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 2 }], canal: 'livraison',
      client, zoneId: 'zone-tana', estMembre: false,
    })
    expect(c.reference).toMatch(/^SC-/)
    expect(c.total).toBe(45000 * 2 + 5000)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(3)
  })

  it('fige le nom et le prix dans la ligne de commande', async () => {
    const variantId = await variantTest(5)
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 1 }], canal: 'livraison',
      client, zoneId: null, estMembre: false,
    })
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: c.id } })
    expect(item.nomFige).toContain('Collier Vahiné')
    expect(item.prixUnitaireFige).toBe(45000)
  })

  it('refuse une commande dépassant le stock disponible', async () => {
    const variantId = await variantTest(1)
    await expect(creerCommande({
      lignes: [{ variantId, quantite: 3 }], canal: 'livraison',
      client, zoneId: null, estMembre: false,
    })).rejects.toBeInstanceOf(RuptureStockError)
  })

  it("n'écrit aucune commande quand le stock manque", async () => {
    const variantId = await variantTest(1)
    await creerCommande({
      lignes: [{ variantId, quantite: 3 }], canal: 'livraison',
      client, zoneId: null, estMembre: false,
    }).catch(() => {})
    expect(await prisma.order.count()).toBe(0)
  })

  it('ne survend jamais sous accès concurrent', async () => {
    const variantId = await variantTest(1)
    const tentative = () => creerCommande({
      lignes: [{ variantId, quantite: 1 }], canal: 'livraison',
      client, zoneId: null, estMembre: false,
    })
    const resultats = await Promise.allSettled([tentative(), tentative(), tentative()])
    const reussies = resultats.filter((r) => r.status === 'fulfilled')
    expect(reussies).toHaveLength(1)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(0)
  })
})
