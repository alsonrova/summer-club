import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import { prisma } from '@/server/db'
import {
  createOrder,
  OutOfStockError,
  EmptyCartError,
  InvalidQuantityError,
  VariantNotFoundError,
  ProductUnavailableError,
  InvalidZoneError,
} from '@/server/orders'

async function variantTest(stock: number) {
  const v = await prisma.variant.findUniqueOrThrow({ where: { sku: 'VAH-45' } })
  await prisma.variant.update({ where: { id: v.id }, data: { stock } })
  return v.id
}

// Toutes les commandes créées ici portent ce nom de cliente, et aucun autre fichier de
// test ne l'emploie : il sert de clé de propriété pour le nettoyage et pour les comptages
// ci-dessous. Sans cette borne, ce fichier vidait la table Order entière et comptait les
// commandes de tout le monde — deux façons d'agir sur un état global qu'il ne possède pas,
// alors que vitest exécute les fichiers en parallèle (voir tests/server/statut.test.ts,
// qui a rendu la collision mesurable).
const CLIENTE = 'Test'

const client = { customerName: CLIENTE, phone: '0320000000' }

// Seule promotion créée par ce fichier, et clé de propriété de son nettoyage : un
// `promotion.deleteMany()` sans filtre viderait la table entière, y compris les lignes
// d'un autre fichier de test s'exécutant en parallèle (vitest.config.ts).
const NOM_PROMOTION = 'Promo test -10%'

/** Comptage borné aux commandes de ce fichier. */
function compterMesCommandes() {
  return prisma.order.count({ where: { clientNom: CLIENTE } })
}

/**
 * Rend au jeu de données de seed (prisma/seed.ts) les valeurs que ce fichier lui emprunte.
 *
 * `collier-vahine` / `VAH-45` sont des lignes de SEED : ce fichier les mute (stock, prix de
 * base, deltaPrix) sans les posséder. Il est le seul à le faire aujourd'hui, mais nettoyer
 * uniquement au DÉBUT de chaque test — ce qu'il faisait — laisse forcément derrière lui
 * l'état du dernier test exécuté : une commande, sa ligne, un stock à 4 au lieu de 5 et un
 * prix de base à 99999. D'où le même nettoyage AVANT et APRÈS.
 */
async function rendreLesDonneesDeSeed() {
  await prisma.order.deleteMany({ where: { clientNom: CLIENTE } })
  await prisma.promotion.deleteMany({ where: { nom: NOM_PROMOTION } })
  await prisma.product.update({
    where: { slug: 'collier-vahine' }, data: { actif: true, prixBase: 45000 },
  })
  await prisma.variant.update({
    where: { sku: 'VAH-45' }, data: { stock: 5, deltaPrix: 0 },
  })
}

// Idempotent : remet à zéro tout état que les tests ci-dessous modifient en base, pour que
// la suite puisse repartir d'une base laissée dans n'importe quel état par une exécution
// interrompue (timeout vitest, Ctrl-C, crash du worker) sans intervention manuelle. Les
// commandes de ce fichier partent avec leurs lignes en cascade (prisma/schema.prisma).
beforeEach(rendreLesDonneesDeSeed)

// Et APRÈS, pour ne rien laisser derrière soi — y compris après le dernier test du fichier,
// que le `beforeEach` seul ne rattrapait jamais.
afterEach(rendreLesDonneesDeSeed)

afterAll(async () => {
  await rendreLesDonneesDeSeed()
  await prisma.$disconnect()
})

describe('createOrder', () => {
  it('crée la commande et décrémente le stock', async () => {
    const variantId = await variantTest(5)
    const c = await createOrder({
      lines: [{ variantId, quantity: 2 }], channel: 'livraison',
      client, zoneId: 'zone-tana', isMember: false,
    })
    expect(c.reference).toMatch(/^SC-/)
    expect(c.total).toBe(45000 * 2 + 5000)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(3)
  })

  it('fige le nom et le prix dans la ligne de commande', async () => {
    const variantId = await variantTest(5)
    const c = await createOrder({
      lines: [{ variantId, quantity: 1 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    })
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: c.id } })
    expect(item.nomFige).toContain('Collier Vahiné')
    expect(item.prixUnitaireFige).toBe(45000)
  })

  it('refuse une commande dépassant le stock disponible', async () => {
    const variantId = await variantTest(1)
    await expect(createOrder({
      lines: [{ variantId, quantity: 3 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    })).rejects.toBeInstanceOf(OutOfStockError)
  })

  it("n'écrit aucune commande quand le stock manque", async () => {
    const variantId = await variantTest(1)
    await createOrder({
      lines: [{ variantId, quantity: 3 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    }).catch(() => {})
    expect(await compterMesCommandes()).toBe(0)
  })

  it('ne survend jamais sous accès concurrent', async () => {
    const variantId = await variantTest(1)
    const tentative = () => createOrder({
      lines: [{ variantId, quantity: 1 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    })
    const resultats = await Promise.allSettled([tentative(), tentative(), tentative()])
    const reussies = resultats.filter((r) => r.status === 'fulfilled')
    expect(reussies).toHaveLength(1)
    // Les tentatives perdantes doivent échouer précisément sur une rupture
    // de stock constatée par le contrôle métier, pas sur un conflit de
    // sérialisation opaque (P2034 / erreur 40001) qui n'aurait jamais
    // atteint ce contrôle : c'est cette assertion qui empêche la
    // régression du correctif d'isolation (Serializable + FOR UPDATE).
    const echouees = resultats.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    )
    expect(echouees).toHaveLength(2)
    for (const echec of echouees) {
      expect(echec.reason).toBeInstanceOf(OutOfStockError)
    }
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(0)
  })

  it('sert les deux clientes concurrentes quand le stock le permet (non-régression : ne doit pas rejeter à tort sur conflit de sérialisation)', async () => {
    const variantId = await variantTest(5)
    const tentative = () => createOrder({
      lines: [{ variantId, quantity: 1 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    })
    const resultats = await Promise.allSettled([tentative(), tentative()])
    const reussies = resultats.filter((r) => r.status === 'fulfilled')
    expect(reussies).toHaveLength(2)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(3)
  })
})

describe('createOrder — validation des entrées', () => {
  it('refuse un panier vide', async () => {
    await expect(createOrder({
      lines: [], channel: 'livraison', client, zoneId: null, isMember: false,
    })).rejects.toBeInstanceOf(EmptyCartError)
  })

  it('refuse une quantité négative sans jamais recréditer le stock (exploitable via stock = stock - (-n))', async () => {
    const variantId = await variantTest(5)
    await expect(createOrder({
      lines: [{ variantId, quantity: -5 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    })).rejects.toBeInstanceOf(InvalidQuantityError)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(5)
    expect(await compterMesCommandes()).toBe(0)
  })

  it('refuse une quantité nulle, non entière, ou supérieure à la borne du panier (20)', async () => {
    const variantId = await variantTest(50)
    for (const quantity of [0, 1.5, 21]) {
      await expect(createOrder({
        lines: [{ variantId, quantity }], channel: 'livraison',
        client, zoneId: null, isMember: false,
      })).rejects.toBeInstanceOf(InvalidQuantityError)
    }
  })
})

describe('createOrder — agrégation des quantités par déclinaison', () => {
  it("agrège deux lignes de la même déclinaison avant le contrôle de stock, plutôt que de les contrôler séparément", async () => {
    const variantId = await variantTest(1)
    await expect(createOrder({
      lines: [{ variantId, quantity: 1 }, { variantId, quantity: 1 }],
      channel: 'livraison', client, zoneId: null, isMember: false,
    })).rejects.toBeInstanceOf(OutOfStockError)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(1)
    expect(await compterMesCommandes()).toBe(0)
  })

  it('écrit une seule ligne de commande avec la quantité agrégée quand le stock suffit', async () => {
    const variantId = await variantTest(5)
    const c = await createOrder({
      lines: [{ variantId, quantity: 1 }, { variantId, quantity: 2 }],
      channel: 'livraison', client, zoneId: null, isMember: false,
    })
    const items = await prisma.orderItem.findMany({ where: { orderId: c.id } })
    expect(items).toHaveLength(1)
    expect(items[0]!.quantite).toBe(3)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(2)
  })

  it("refuse deux lignes de 20 sur la même déclinaison même si le stock les couvre (la borne MAX_QUANTITY porte sur la quantité agrégée)", async () => {
    const variantId = await variantTest(50)
    await expect(createOrder({
      lines: [{ variantId, quantity: 20 }, { variantId, quantity: 20 }],
      channel: 'livraison', client, zoneId: null, isMember: false,
    })).rejects.toBeInstanceOf(InvalidQuantityError)
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(50)
    expect(await compterMesCommandes()).toBe(0)
  })
})

describe('createOrder — réservation du stock selon le canal', () => {
  it('réserve le stock dès la création pour le canal orange_money (en_attente_paiement)', async () => {
    const variantId = await variantTest(5)
    const c = await createOrder({
      lines: [{ variantId, quantity: 2 }], channel: 'orange_money',
      client, zoneId: null, isMember: false,
    })
    const commande = await prisma.order.findUniqueOrThrow({ where: { id: c.id } })
    expect(commande.statut).toBe('en_attente_paiement')
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(3)
  })

  it('ne réserve rien à la création pour le canal whatsapp (en_attente_confirmation)', async () => {
    const variantId = await variantTest(5)
    const c = await createOrder({
      lines: [{ variantId, quantity: 2 }], channel: 'whatsapp',
      client, zoneId: null, isMember: false,
    })
    const commande = await prisma.order.findUniqueOrThrow({ where: { id: c.id } })
    expect(commande.statut).toBe('en_attente_confirmation')
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(v.stock).toBe(5)
  })
})

describe('createOrder — produits et zones désactivés', () => {
  it('refuse une commande sur un produit désactivé', async () => {
    const variant = await prisma.variant.findUniqueOrThrow({ where: { sku: 'VAH-45' } })
    await prisma.variant.update({ where: { id: variant.id }, data: { stock: 5 } })
    await prisma.product.update({ where: { id: variant.productId }, data: { actif: false } })
    await expect(createOrder({
      lines: [{ variantId: variant.id, quantity: 1 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    })).rejects.toBeInstanceOf(ProductUnavailableError)
    expect(await compterMesCommandes()).toBe(0)
  })

  it('refuse une commande vers une zone de livraison désactivée', async () => {
    const variantId = await variantTest(5)
    const zone = await prisma.deliveryZone.create({
      data: { nom: 'Zone test désactivée', tarif: 1000, delai: '48 h', actif: false },
    })
    try {
      await expect(createOrder({
        lines: [{ variantId, quantity: 1 }], channel: 'livraison',
        client, zoneId: zone.id, isMember: false,
      })).rejects.toBeInstanceOf(InvalidZoneError)
      expect(await compterMesCommandes()).toBe(0)
    } finally {
      await prisma.deliveryZone.delete({ where: { id: zone.id } })
    }
  })
})

describe('createOrder — erreurs typées', () => {
  it('lève VariantNotFoundError pour une déclinaison inexistante plutôt qu\'une erreur Prisma brute', async () => {
    await expect(createOrder({
      lines: [{ variantId: 'variant-inexistant', quantity: 1 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    })).rejects.toBeInstanceOf(VariantNotFoundError)
  })

  it('lève InvalidZoneError pour une zone inexistante plutôt qu\'une violation de clé étrangère', async () => {
    const variantId = await variantTest(5)
    await expect(createOrder({
      lines: [{ variantId, quantity: 1 }], channel: 'livraison',
      client, zoneId: 'zone-inexistante', isMember: false,
    })).rejects.toBeInstanceOf(InvalidZoneError)
  })
})

describe('createOrder — prix figé', () => {
  it('fige le prix effectif après promotion et deltaPrix de la déclinaison, pas le prix de base du produit', async () => {
    const variant = await prisma.variant.findUniqueOrThrow({
      where: { sku: 'VAH-45' }, include: { product: true },
    })
    await prisma.variant.update({
      where: { id: variant.id }, data: { stock: 5, deltaPrix: 3000 },
    })
    await prisma.promotion.create({
      data: {
        nom: NOM_PROMOTION, type: 'percent', valeur: 10,
        portee: 'produit', cibleId: variant.productId, actif: true,
      },
    })
    const c = await createOrder({
      lines: [{ variantId: variant.id, quantity: 1 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    })
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: c.id } })
    // (prixBase 45000 + deltaPrix 3000) remisé de 10% = 43200
    expect(item.prixUnitaireFige).toBe(43200)
  })

  it("conserve le prix figé de la ligne de commande même si le prix de base du produit change ensuite", async () => {
    const variantId = await variantTest(5)
    const variant = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    const c = await createOrder({
      lines: [{ variantId, quantity: 1 }], channel: 'livraison',
      client, zoneId: null, isMember: false,
    })
    await prisma.product.update({
      where: { id: variant.productId }, data: { prixBase: 99999 },
    })
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: c.id } })
    expect(item.prixUnitaireFige).toBe(45000)
  })
})
