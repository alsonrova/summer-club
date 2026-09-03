import { test, expect, type TestInfo } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'

// Réutilise la session administrateur écrite une seule fois par e2e/auth.setup.ts, comme
// e2e/admin-products.spec.ts : aucun de ces tests ne vérifie le parcours de connexion, et
// s'y reconnecter saturerait le compartiment de limitation de débit partagé de
// /sign-in/email (voir src/server/auth.ts).
test.use({ storageState: path.join(__dirname, '.auth', 'admin.json') })

const prisma = new PrismaClient()

// Chaque test possède SES données, dérivées de son identité (leçon de la tâche 11 :
// `test.afterAll` s'exécute une fois par worker, un nettoyage global détruit les données
// d'un test que ce worker n'a jamais joué). Aucun test ne touche à celles d'un autre.
function testKey(testInfo: TestInfo): string {
  const identity = testInfo.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  // Rang de répétition toujours suffixé : sans lui, la référence de la première
  // répétition serait un préfixe de celle des suivantes, et le filtre par sous-chaîne de
  // la liste ferait voir à un test les commandes d'un autre sous `--repeat-each`.
  return `E2ECMD-${identity}-R${testInfo.repeatEachIndex}`
}

const productSlug = (key: string) => key.toLowerCase()
// Une catégorie PAR TEST, pas une catégorie partagée : une catégorie commune resterait en
// base après la suite (aucun test ne pouvant la supprimer sans risquer de la retirer sous
// les pieds d'un autre worker), et polluerait le catalogue de la boutique.
const categorySlug = (key: string) => `cat-${key.toLowerCase()}`

async function cleanUp(key: string) {
  const orders = await prisma.order.findMany({
    where: { reference: { startsWith: key } },
    select: { id: true },
  })
  const ids = orders.map((c) => c.id)
  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity: 'Order', entityId: { in: ids } } })
    await prisma.order.deleteMany({ where: { id: { in: ids } } })
  }
  // Le produit part avec sa déclinaison en cascade — mais seulement après les commandes,
  // qui référencent la déclinaison (OrderItem → Variant n'est pas en cascade). Puis la
  // catégorie, qui n'a plus de produit (Product → Category n'est pas en cascade non plus).
  await prisma.product.deleteMany({ where: { slug: productSlug(key) } })
  await prisma.category.deleteMany({ where: { slug: categorySlug(key) } })
}

/** Crée un produit, une déclinaison et une commande propres au test appelant. */
async function prepareOrder(
  key: string,
  options: { channel: 'whatsapp' | 'cash_on_delivery'; status: 'pending_confirmation' | 'cancelled'; stock: number; quantity: number },
) {
  const category = await prisma.category.upsert({
    where: { slug: categorySlug(key) },
    update: {},
    create: { slug: categorySlug(key), name: `Catégorie ${key}`, displayOrder: 997 },
  })
  const product = await prisma.product.create({
    data: {
      slug: productSlug(key),
      name: `Produit ${key}`,
      description: 'Produit créé uniquement pour un test de bout en bout.',
      categoryId: category.id,
      basePrice: 45000,
      variants: { create: { label: 'Unique', sku: key, stock: options.stock } },
    },
    include: { variants: true },
  })
  const variant = product.variants[0]!

  const order = await prisma.order.create({
    data: {
      reference: key,
      trackingToken: `token-${key}`,
      channel: options.channel,
      status: options.status,
      customerName: 'Cliente e2e',
      phone: '0320000000',
      subtotal: 45000 * options.quantity,
      shippingFee: 0,
      total: 45000 * options.quantity,
      items: {
        create: {
          variantId: variant.id,
          nameSnapshot: `Produit ${key} — Unique`,
          unitPriceSnapshot: 45000,
          quantity: options.quantity,
        },
      },
    },
  })

  return { order, variantId: variant.id }
}

test.beforeEach(async ({}, testInfo) => {
  await cleanUp(testKey(testInfo))
})

test.afterEach(async ({}, testInfo) => {
  await cleanUp(testKey(testInfo))
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('la liste retrouve une commande par sa référence et ouvre sa fiche', async ({ page }, testInfo) => {
  const key = testKey(testInfo)
  await prepareOrder(key, {
    channel: 'whatsapp', status: 'pending_confirmation', stock: 5, quantity: 2,
  })

  await page.goto('/admin/commandes')
  await page.getByLabel('Référence').fill(key)
  await page.getByRole('button', { name: 'Filtrer' }).click()

  await page.getByRole('link', { name: key }).click()
  await expect(page.getByRole('heading', { name: `Commande ${key}` })).toBeVisible()
  // Les lignes sont figées à la commande : le nom conservé, pas celui du catalogue courant.
  await expect(page.getByText(`Produit ${key} — Unique`)).toBeVisible()
})

test('confirmer une commande WhatsApp décrémente le stock', async ({ page }, testInfo) => {
  const key = testKey(testInfo)
  const { order, variantId } = await prepareOrder(key, {
    channel: 'whatsapp', status: 'pending_confirmation', stock: 5, quantity: 2,
  })

  await page.goto(`/admin/commandes/${order.id}`)
  // Une commande WhatsApp n'a rien réservé : le stock est encore entier avant l'accord.
  expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(5)

  await page.getByRole('button', { name: 'Confirmer la commande' }).click()

  // L'historique n'affiche cette ligne qu'une fois la transaction validée et la page
  // revalidée : c'est ce qui garantit qu'on relit ensuite un stock déjà écrit.
  await expect(page.getByText('En attente de confirmation → Confirmée')).toBeVisible()
  expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(3)
})

test("une commande annulée n'offre plus aucune transition", async ({ page }, testInfo) => {
  const key = testKey(testInfo)
  const { order } = await prepareOrder(key, {
    channel: 'cash_on_delivery', status: 'cancelled', stock: 5, quantity: 1,
  })

  await page.goto(`/admin/commandes/${order.id}`)
  await expect(page.getByText('Cette commande a atteint un état final')).toBeVisible()
  await expect(page.getByRole('button', { name: /Confirmer|Marquer|Mettre|Annuler/ })).toHaveCount(0)
})
