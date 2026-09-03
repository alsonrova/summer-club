import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { createOrder, OutOfStockError } from '@/server/orders'
import { applyStatus, ForbiddenTransitionError } from '@/server/order-status-service'

// Les tests visent applyStatus : changerStatut n'en est que
// l'enveloppe authentifiée, et requireAdmin n'a pas de sens hors requête.
const changeStatus = (id: string, to: Parameters<typeof applyStatus>[1]) =>
  applyStatus(id, to, 'test')

let variantId: string

// Jeu de données PROPRE à ce fichier, et non la déclinaison de seed « VAH-45 ».
//
// Le brief proposait de réutiliser VAH-45 et de vider les tables Order/OrderItem
// entières entre chaque test. Mesuré : ce fichier et tests/server/orders.test.ts
// s'exécutent en parallèle (vitest.config.ts, fileParallelism laissé au défaut) et se
// disputaient alors exactement les mêmes lignes. Trois exécutions de la suite complète
// ont donné 4, 4 puis 2 échecs, répartis dans LES DEUX fichiers et jamais les mêmes :
// « expected 6 to be 3 » (le stock de VAH-45 remis à 10 par un fichier au milieu du test
// de l'autre), « expected 8 to be 10 » (la commande annulée ici supprimée par le
// `order.deleteMany()` global de l'autre fichier avant sa relecture), « promise resolved
// instead of rejecting » (stock remonté sous les pieds du test de rupture).
//
// Ce n'est pas une intermittence de la base ni du code testé : c'est un partage de
// données mutables entre deux fichiers dont aucun ne les possède — la même faute que la
// tâche 11 avait corrigée pour public/uploads et pour les produits e2e. La réponse est
// donc la même : chaque fichier possède ses propres lignes et ne supprime que les
// siennes. Ni sérialisation des fichiers, ni plafond de workers, ni réessai.
//
// Les trois tests du brief (describe « changerStatut » ci-dessous) sont repris mot pour
// mot ; seule cette fixture partagée a changé.
const CATEGORY_SLUG = 'test-statuts-categorie'
const PRODUCT_SLUG = 'test-statuts-produit'
const SKU = 'STATUT-45'

const client = { customerName: 'T', phone: '0320000000' }

/** Toutes les commandes de ce fichier — et elles seules — portent cette déclinaison. */
function myOrders() {
  return { items: { some: { variantId } } }
}

async function purgeMyOrders() {
  const mine = await prisma.order.findMany({ where: myOrders(), select: { id: true } })
  const ids = mine.map((o) => o.id)
  if (ids.length === 0) return
  // Bornée à mes propres identifiants : le journal d'audit est une table globale que ce
  // fichier ne possède pas, on n'y touche que les lignes qu'on y a écrites.
  await prisma.auditLog.deleteMany({ where: { entity: 'Order', entityId: { in: ids } } })
  await prisma.order.deleteMany({ where: { id: { in: ids } } })
}

// Idempotent : la suite repart d'une base laissée dans n'importe quel état par une
// exécution interrompue (Ctrl-C, crash du worker), sans intervention manuelle.
beforeAll(async () => {
  const category = await prisma.category.upsert({
    where: { slug: CATEGORY_SLUG },
    update: {},
    create: { slug: CATEGORY_SLUG, name: 'Catégorie de test (statuts)', displayOrder: 999 },
  })
  const product = await prisma.product.upsert({
    where: { slug: PRODUCT_SLUG },
    update: { active: true, basePrice: 45000, categoryId: category.id },
    create: {
      slug: PRODUCT_SLUG,
      name: 'Produit de test (statuts)',
      description: 'Jeu de données réservé à tests/server/order-status-service.test.ts.',
      categoryId: category.id,
      basePrice: 45000,
      costPrice: 18000,
    },
  })
  await prisma.variant.upsert({
    where: { sku: SKU },
    update: { stock: 10, priceDelta: 0, productId: product.id },
    create: { productId: product.id, label: '45 cm', sku: SKU, stock: 10 },
  })
})

beforeEach(async () => {
  const v = await prisma.variant.findUniqueOrThrow({ where: { sku: SKU } })
  variantId = v.id
  await purgeMyOrders()
  await prisma.variant.update({ where: { id: v.id }, data: { stock: 10 } })
})

afterEach(purgeMyOrders)

// `vitest.config.ts` n'active pas `restoreMocks` : un espion posé par un test resterait
// posé pour les suivants si son `mockRestore()` n'était pas atteint. Filet, en plus du
// `finally` du seul test qui en pose un.
afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await purgeMyOrders()
  // Le produit est supprimé avec sa déclinaison en cascade (schema.prisma) : le catalogue
  // de la boutique ne garde aucune trace de ce jeu de données une fois la suite terminée.
  await prisma.product.deleteMany({ where: { slug: PRODUCT_SLUG } })
  await prisma.category.deleteMany({ where: { slug: CATEGORY_SLUG } })
  await prisma.$disconnect()
})

describe('changerStatut', () => {
  it('recrédite le stock à l\'annulation d\'une commande confirmée', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 3 }], channel: 'cash_on_delivery',
      client: { customerName: 'T', phone: '0320000000' }, zoneId: null, isMember: false,
    })
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(7)

    await changeStatus(c.id, 'cancelled')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })

  it('refuse une transition interdite', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 1 }], channel: 'cash_on_delivery',
      client: { customerName: 'T', phone: '0320000000' }, zoneId: null, isMember: false,
    })
    await changeStatus(c.id, 'cancelled')
    await expect(changeStatus(c.id, 'shipped')).rejects.toThrow(/transition/i)
  })

  it('ne recrédite pas deux fois si l\'annulation est rejouée', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 2 }], channel: 'cash_on_delivery',
      client: { customerName: 'T', phone: '0320000000' }, zoneId: null, isMember: false,
    })
    await changeStatus(c.id, 'cancelled')
    await changeStatus(c.id, 'cancelled').catch(() => {})
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })
})

describe('applyStatus — transitions interdites', () => {
  it('lève ForbiddenTransitionError (famille OrderError) avec un message français, sans toucher au stock', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 2 }], channel: 'cash_on_delivery', client,
      zoneId: null, isMember: false,
    })
    // confirmed → delivered n'est pas une transition déclarée : il faut passer par
    // preparing, puis shipped ou ready_for_pickup.
    await expect(changeStatus(c.id, 'delivered')).rejects.toBeInstanceOf(ForbiddenTransitionError)
    await expect(changeStatus(c.id, 'delivered')).rejects.toThrow(
      'Transition interdite : confirmed → delivered',
    )
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(8)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('confirmed')
  })
})

describe('applyStatus — confirmation d\'une commande WhatsApp', () => {
  it('décrémente le stock à la confirmation, puisque rien n\'était réservé à la création', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 2 }], channel: 'whatsapp', client,
      zoneId: null, isMember: false,
    })
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)

    await changeStatus(c.id, 'confirmed')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(8)
  })

  it('lève OutOfStockError quand le stock est parti entre-temps, sans laisser la contrainte CHECK de la base rattraper le coup', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 3 }], channel: 'whatsapp', client,
      zoneId: null, isMember: false,
    })
    // Le stock part ailleurs entre la prise de commande WhatsApp et son acceptation :
    // c'est le scénario métier réel, une commande WhatsApp ne réserve rien.
    await prisma.variant.update({ where: { id: variantId }, data: { stock: 1 } })

    await expect(changeStatus(c.id, 'confirmed')).rejects.toBeInstanceOf(OutOfStockError)

    // Le contrôle métier doit avoir refusé AVANT toute écriture : ni stock négatif rattrapé
    // par la contrainte `variant_stock_non_negatif`, ni statut avancé à tort.
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(1)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'pending_confirmation',
    )
  })

  it('ne décrémente qu\'une fois si la confirmation est rejouée', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 4 }], channel: 'whatsapp', client,
      zoneId: null, isMember: false,
    })
    await changeStatus(c.id, 'confirmed')
    await changeStatus(c.id, 'confirmed').catch(() => {})
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(6)
  })
})

describe('applyStatus — stock déjà engagé', () => {
  it('ne décrémente pas une seconde fois à la confirmation d\'un paiement Orange Money', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 2 }], channel: 'orange_money', client,
      zoneId: null, isMember: false,
    })
    // en_attente_paiement appartient à STOCK_COMMITTED : la réservation a eu lieu à la création.
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(8)

    await changeStatus(c.id, 'confirmed')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(8)
  })

  it('recrédite un paiement échoué puis annulé exactement une fois', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 3 }], channel: 'orange_money', client,
      zoneId: null, isMember: false,
    })
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(7)

    // en_attente_paiement → echec_paiement sort de STOCK_COMMITTED : le stock revient.
    await changeStatus(c.id, 'payment_failed')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)

    // echec_paiement → annulee : les deux sont hors de STOCK_COMMITTED, rien ne bouge.
    await changeStatus(c.id, 'cancelled')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })
})

describe('applyStatus — accès concurrent sur la même commande', () => {
  it('n\'applique qu\'un seul des deux changements de statut simultanés', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 3 }], channel: 'cash_on_delivery', client,
      zoneId: null, isMember: false,
    })
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(7)

    const results = await Promise.allSettled([
      changeStatus(c.id, 'cancelled'),
      changeStatus(c.id, 'cancelled'),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    )
    expect(failed).toHaveLength(1)
    // La perdante doit être arrêtée par la machine à états après avoir RELU le statut réel,
    // pas par un conflit de sérialisation opaque (P2034 / 40001) qui n'aurait jamais atteint
    // ce contrôle : c'est cette assertion qui empêche la régression du correctif
    // d'isolation (Serializable + FOR UPDATE, cf. src/server/order-status-service.ts).
    expect(failed[0]!.reason).toBeInstanceOf(ForbiddenTransitionError)

    // Un seul recrédit, donc le stock initial — pas 13.
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })

  it('sert deux annulations concurrentes de commandes DIFFÉRENTES sans en rejeter une à tort', async () => {
    const [a, b] = await Promise.all([
      createOrder({
        lines: [{ variantId, quantity: 2 }], channel: 'cash_on_delivery', client,
        zoneId: null, isMember: false,
      }),
      createOrder({
        lines: [{ variantId, quantity: 3 }], channel: 'cash_on_delivery', client,
        zoneId: null, isMember: false,
      }),
    ])
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(5)

    const results = await Promise.allSettled([
      changeStatus(a.id, 'cancelled'),
      changeStatus(b.id, 'cancelled'),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2)
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })
})

describe('applyStatus — journal d\'audit', () => {
  it('journalise l\'acteur, l\'ancien et le nouveau statut', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 1 }], channel: 'whatsapp', client,
      zoneId: null, isMember: false,
    })
    await applyStatus(c.id, 'confirmed', 'proprietaire@summerclub.mg')

    // Assertion bornée à MA commande : le journal d'audit est une table globale que ce
    // fichier ne possède pas.
    const auditTraces = await prisma.auditLog.findMany({
      where: { entity: 'Order', entityId: c.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(auditTraces).toHaveLength(1)
    expect(auditTraces[0]!.actor).toBe('proprietaire@summerclub.mg')
    expect(auditTraces[0]!.action).toBe('change_status')
    expect(auditTraces[0]!.before).toEqual({ status: 'pending_confirmation' })
    expect(auditTraces[0]!.after).toEqual({ status: 'confirmed' })
  })

  it("écrit la trace AVEC le client de transaction, donc l'annule avec elle", async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 2 }], channel: 'whatsapp', client,
      zoneId: null, isMember: false,
    })

    // Le seul moment où `tx` se distingue du client global est un ROLLBACK POSTÉRIEUR à
    // l'écriture de la trace : écrite avec le client global, elle serait partie sur une
    // autre connexion et aurait SURVÉCU à l'annulation — le journal affirmerait alors un
    // changement de statut que la base n'a jamais enregistré. On laisse donc le corps
    // d'applyStatus aller jusqu'au bout, puis on avorte la transaction depuis
    // l'extérieur, sans toucher au code testé.
    //
    // C'est ce test-là qui échouerait si quelqu'un repassait `recordAudit` au client
    // global. Le test voisin (« n'écrit aucune trace quand la transition est refusée ») ne
    // le ferait pas : sur ce chemin, la fonction lève AVANT l'écriture d'audit, qui n'est
    // jamais atteinte.
    class FailureAfterWrite extends Error {}
    const realTransaction = prisma.$transaction.bind(prisma) as (
      body: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: unknown,
    ) => Promise<unknown>
    const transactionSpy = vi.spyOn(prisma, '$transaction')
    transactionSpy.mockImplementation(((
      body: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: unknown,
    ) =>
      realTransaction(async (tx) => {
        await body(tx)
        throw new FailureAfterWrite()
      }, options)) as never)

    try {
      await expect(
        applyStatus(c.id, 'confirmed', 'proprietaire@summerclub.mg'),
      ).rejects.toBeInstanceOf(FailureAfterWrite)
    } finally {
      // Restauré même si l'assertion ci-dessus échoue.
      transactionSpy.mockRestore()
    }

    // Assertion bornée à MA commande : le journal d'audit est une table globale.
    expect(
      await prisma.auditLog.count({ where: { entity: 'Order', entityId: c.id } }),
    ).toBe(0)
    // Contrôle du contrôle : c'est bien la transaction ENTIÈRE qui a été annulée, sinon
    // l'absence de trace ne prouverait rien.
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'pending_confirmation',
    )
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })

  it('n\'écrit aucune trace quand la transition est refusée', async () => {
    const c = await createOrder({
      lines: [{ variantId, quantity: 1 }], channel: 'cash_on_delivery', client,
      zoneId: null, isMember: false,
    })
    await changeStatus(c.id, 'delivered').catch(() => {})
    expect(
      await prisma.auditLog.count({ where: { entity: 'Order', entityId: c.id } }),
    ).toBe(0)
  })
})
