import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@/server/db'
import { listOrdersPaginated, ORDERS_PER_PAGE } from '@/app/admin/commandes/query'
import { CHANNELS, isChannel } from '@/admin/resources/orders'

// Vérifie que la liste des commandes interroge réellement la base (skip/take + comptage)
// plutôt que de charger toutes les commandes en mémoire pour les découper ensuite — le
// piège explicitement signalé pour cette tâche.
//
// Les commandes de ce fichier portent toutes ce préfixe de référence, et c'est par lui
// qu'elles sont sélectionnées ET nettoyées : aucun `deleteMany()` sans filtre, aucun
// comptage global. Les fichiers de test s'exécutent en parallèle (vitest.config.ts).
const PREFIX = 'PAGCMD-'
const TOTAL = ORDERS_PER_PAGE + 5

// Horodatage identique pour toutes les commandes : c'est le cas réel qui casse un tri sur
// `createdAt` seul (une rafale de commandes, un import). Voir le test de stabilité ci-dessous.
const SAME_INSTANT = new Date('2026-08-01T10:00:00.000Z')

async function purge() {
  await prisma.order.deleteMany({ where: { reference: { startsWith: PREFIX } } })
}

beforeAll(async () => {
  // Défensif : rattrape une exécution précédente interrompue (Ctrl-C, crash du worker).
  await purge()

  for (let i = 0; i < TOTAL; i++) {
    await prisma.order.create({
      data: {
        reference: `${PREFIX}${String(i).padStart(4, '0')}`,
        trackingToken: `token-${PREFIX}${i}`,
        channel: i % 2 === 0 ? 'whatsapp' : 'cash_on_delivery',
        status: i % 3 === 0 ? 'confirmed' : 'pending_confirmation',
        customerName: `Cliente ${i}`,
        phone: '0320000000',
        subtotal: 45000,
        shippingFee: 0,
        total: 45000,
        createdAt: SAME_INSTANT,
      },
    })
  }
})

afterAll(async () => {
  await purge()
  await prisma.$disconnect()
})

// `vitest.config.ts` n'active pas `restoreMocks` : un `mockRestore()` en fin de test ne
// s'exécuterait pas si une assertion échouait avant lui, et l'espion resterait posé sur
// `prisma.order` pour les tests suivants du fichier.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('listOrdersPaginated', () => {
  it('interroge la base avec skip/take plutôt que de charger toutes les commandes', async () => {
    const findManySpy = vi.spyOn(prisma.order, 'findMany')
    const countSpy = vi.spyOn(prisma.order, 'count')

    const result = await listOrdersPaginated(prisma.order, {
      page: 1,
      filters: { reference: PREFIX },
    })

    expect(countSpy).toHaveBeenCalled()
    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: ORDERS_PER_PAGE }),
    )
    expect(result.rows).toHaveLength(ORDERS_PER_PAGE)
    expect(result.total).toBe(TOTAL)
    expect(result.totalPages).toBe(2)
  })

  it("trie sur une clé unique en second critère, sans quoi une même ligne peut sortir sur deux pages", async () => {
    // L'espion est ce qui donne sa valeur protectrice à ce test : les 25 commandes
    // partagent le même `createdAt`, mais PostgreSQL renvoie en pratique un ordre stable
    // tant que rien ne le perturbe — un retour en arrière sur le second critère de tri ne
    // serait donc pas détecté par les seules lignes obtenues.
    const findManySpy = vi.spyOn(prisma.order, 'findMany')

    const page1 = await listOrdersPaginated(prisma.order, {
      page: 1, filters: { reference: PREFIX },
    })
    const page2 = await listOrdersPaginated(prisma.order, {
      page: 2, filters: { reference: PREFIX },
    })

    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    )

    expect(page1.rows).toHaveLength(ORDERS_PER_PAGE)
    expect(page2.rows).toHaveLength(5)

    const ids = [...page1.rows.map((l) => l.id), ...page2.rows.map((l) => l.id)]
    // Ni doublon d'une page à l'autre, ni ligne oubliée.
    expect(new Set(ids).size).toBe(TOTAL)
  })

  it('filtre par statut', async () => {
    const expected = await prisma.order.count({
      where: { reference: { startsWith: PREFIX }, status: 'confirmed' },
    })
    const result = await listOrdersPaginated(prisma.order, {
      page: 1, filters: { reference: PREFIX, status: 'confirmed' },
    })
    expect(result.total).toBe(expected)
    expect(result.rows.every((l) => l.status === 'confirmed')).toBe(true)
  })

  it('filtre par canal', async () => {
    const result = await listOrdersPaginated(prisma.order, {
      page: 1, filters: { reference: PREFIX, channel: 'whatsapp' },
    })
    expect(result.rows.length).toBeGreaterThan(0)
    expect(result.rows.every((l) => l.channel === 'whatsapp')).toBe(true)
  })

  it('retrouve une commande par un fragment de référence, sans respect de la casse', async () => {
    const result = await listOrdersPaginated(prisma.order, {
      page: 1, filters: { reference: 'pagcmd-0007' },
    })
    expect(result.total).toBe(1)
    expect(result.rows[0]?.reference).toBe(`${PREFIX}0007`)
  })

  it('ramène une page demandée hors bornes à la dernière page existante', async () => {
    const result = await listOrdersPaginated(prisma.order, {
      page: 999, filters: { reference: PREFIX },
    })
    expect(result.page).toBe(result.totalPages)
    expect(result.rows.length).toBeGreaterThan(0)
  })
})

// `isChannel` vit auprès de `CHANNELS` (src/admin/resources/orders.ts), comme `isOrderStatus` vit
// auprès de `ORDER_STATUSES` et `isReviewStatus` auprès de `REVIEW_STATUSES` : une seule façon de
// valider une valeur d'énumération venue du client dans ce projet. Il est testé ici parce
// que c'est le filtre de CETTE liste qu'il protège.
describe('isChannel', () => {
  it('accepte les trois canaux déclarés', () => {
    expect(CHANNELS.every((c) => isChannel(c))).toBe(true)
  })

  it("refuse une valeur forgée dans la querystring, plutôt que de la transmettre à Prisma", () => {
    expect(isChannel('pigeon_voyageur')).toBe(false)
    expect(isChannel('')).toBe(false)
  })

  it("refuse ce qui n'est pas une chaîne — un paramètre d'URL peut être absent ou répété", () => {
    expect(isChannel(undefined)).toBe(false)
    expect(isChannel(null)).toBe(false)
    expect(isChannel(['whatsapp'])).toBe(false)
  })
})
