import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { OrderError, createOrder } from '@/server/orders'
import { pathsToRevalidate } from '@/server/order-status-service'
import { initialStatusChangeState } from '@/app/admin/commandes/states'

// Mêmes doublures que tests/admin/avis-actions.test.ts : requireAdmin() lit une session via
// next/headers et revalidatePath() exige un contexte de requête App Router — ni l'un ni
// l'autre n'existe sous Vitest.
vi.mock('@/server/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { email: 'admin@test.dev' } }),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { revalidatePath } = await import('next/cache')
const { changeStatus, changeStatusFromForm } = await import(
  '@/app/admin/commandes/actions'
)

// Ce que ce fichier couvre, et que rien ne couvrait : les ACTIONS de commande. Le cœur
// métier (`applyStatus`) a ses propres tests dans tests/server/statut.test.ts, et la
// requête de liste dans tests/admin/commandes-query.test.ts — mais l'enveloppe
// authentifiée et son adaptateur `useActionState` n'étaient exercés qu'en bout-en-bout,
// sur le chemin heureux. Or c'est précisément là que vivent le garde de type sur le statut
// et la TRADUCTION EN FRANÇAIS des erreurs métier : deux comportements qu'aucun test
// n'atteignait.

// Jeu de données propre à ce fichier — ni la déclinaison de seed VAH-45, ni celle de
// tests/server/statut.test.ts : les fichiers s'exécutent en parallèle (vitest.config.ts) et
// aucun ne possède les lignes d'un autre.
const CATEGORY_SLUG = 'test-cmd-actions-categorie'
const PRODUCT_SLUG = 'test-cmd-actions-produit'
const SKU = 'CMDACT-45'

const client = { customerName: 'Cliente de test (actions commandes)', phone: '0320000000' }

let variantId: string

/** Toutes les commandes de ce fichier — et elles seules — portent cette déclinaison. */
async function purgeMyOrders() {
  const mine = await prisma.order.findMany({
    where: { items: { some: { variantId } } },
    select: { id: true },
  })
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
    create: { slug: CATEGORY_SLUG, name: 'Catégorie de test (actions commandes)', displayOrder: 997 },
  })
  const product = await prisma.product.upsert({
    where: { slug: PRODUCT_SLUG },
    update: { active: true, basePrice: 45000, categoryId: category.id },
    create: {
      slug: PRODUCT_SLUG,
      name: 'Produit de test (actions commandes)',
      description: 'Jeu de données réservé à tests/admin/commandes-actions.test.ts.',
      categoryId: category.id,
      basePrice: 45000,
      costPrice: 18000,
    },
  })
  const variant = await prisma.variant.upsert({
    where: { sku: SKU },
    update: { stock: 10, priceDelta: 0, productId: product.id },
    create: { productId: product.id, label: '45 cm', sku: SKU, stock: 10 },
  })
  variantId = variant.id
})

beforeEach(async () => {
  await purgeMyOrders()
  await prisma.variant.update({ where: { id: variantId }, data: { stock: 10 } })
  vi.mocked(revalidatePath).mockClear()
})

afterEach(async () => {
  await purgeMyOrders()
  // `vitest.config.ts` n'active pas `restoreMocks` : sans ceci, un espion posé par un test
  // qui échoue avant son propre nettoyage resterait posé pour les suivants.
  vi.restoreAllMocks()
})

// Rend la base à l'état où ce fichier l'a trouvée : ses commandes, sa catégorie, son
// produit et sa déclinaison (supprimée en cascade avec le produit, voir prisma/schema.prisma)
// disparaissent. Un fichier qui ne nettoie qu'au DÉBUT de chaque test laisse toujours les
// données de son dernier test derrière lui.
afterAll(async () => {
  await purgeMyOrders()
  await prisma.product.deleteMany({ where: { slug: PRODUCT_SLUG } })
  await prisma.category.deleteMany({ where: { slug: CATEGORY_SLUG } })
  await prisma.$disconnect()
})

async function whatsappOrder(quantity: number) {
  return createOrder({
    lines: [{ variantId, quantity }],
    channel: 'whatsapp',
    client,
    zoneId: null,
    isMember: false,
  })
}

async function confirmedOrder(quantity: number) {
  return createOrder({
    lines: [{ variantId, quantity }],
    channel: 'cash_on_delivery',
    client,
    zoneId: null,
    isMember: false,
  })
}

describe('changeStatus — garde de type sur le statut', () => {
  it("refuse un statut forgé avant qu'il n'atteigne l'énumération PostgreSQL", async () => {
    const c = await confirmedOrder(1)

    // Une Server Action exportée est une route publique : protégée par requireAdmin(),
    // mais pas typée à l'exécution.
    await expect(changeStatus(c.id, 'supprimee' as never)).rejects.toThrow(
      'Statut inconnu : supprimee',
    )

    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'confirmed',
    )
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(9)
  })
})

describe('changeStatus — chemin nominal', () => {
  it('applique la transition et invalide tous les chemins publiés par le cœur métier', async () => {
    const c = await whatsappOrder(2)

    await changeStatus(c.id, 'confirmed')

    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'confirmed',
    )
    // La liste vient du module métier, elle n'est pas recopiée ici : c'est ce qui garantit
    // qu'aucun chemin ajouté à `pathsToRevalidate` ne sera oublié par l'action.
    for (const mediaPath of pathsToRevalidate(c.id)) {
      expect(revalidatePath).toHaveBeenCalledWith(mediaPath)
    }
  })
})

describe('changeStatusFromForm — traduction des erreurs métier', () => {
  it("traduit une transition devenue impossible en français, avec les libellés d'écran", async () => {
    const c = await confirmedOrder(2)

    // confirmee → livree n'est pas une transition déclarée : c'est ce que voit un onglet
    // resté sur un rendu périmé.
    const state = await changeStatusFromForm(
      c.id,
      'delivered',
      initialStatusChangeState,
      new FormData(),
    )

    expect(state.error).toContain('« Confirmée »')
    expect(state.error).toContain('« Livrée »')
    expect(state.error).toContain('Rechargez la page.')
    // Ni valeur brute d'énumération, ni nom de classe d'erreur sous les yeux de la
    // propriétaire.
    expect(state.error).not.toMatch(/confirmed|delivered|ForbiddenTransition/)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'confirmed',
    )
  })

  it('traduit une rupture de stock en français plutôt que de la laisser remonter', async () => {
    // Une commande WhatsApp ne réserve rien : le stock peut partir entre la prise de
    // commande et son acceptation.
    const c = await whatsappOrder(3)
    await prisma.variant.update({ where: { id: variantId }, data: { stock: 1 } })

    const state = await changeStatusFromForm(
      c.id,
      'confirmed',
      initialStatusChangeState,
      new FormData(),
    )

    expect(state.error).toContain('Stock insuffisant')
    expect(state.error).toContain('Réapprovisionnez')
    expect(state.error).not.toMatch(/OutOfStock|prisma|constraint/i)
    // Refusée avant toute écriture : ni stock entamé, ni statut avancé à tort.
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(1)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'pending_confirmation',
    )
  })

  it('rend { error: null } quand la transition passe', async () => {
    const c = await whatsappOrder(2)

    const state = await changeStatusFromForm(
      c.id,
      'confirmed',
      initialStatusChangeState,
      new FormData(),
    )

    expect(state).toEqual({ error: null })
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      'confirmed',
    )
  })

  it('laisse remonter une panne technique au lieu de la déguiser en message métier', async () => {
    // Une commande inexistante n'est pas une situation normale que la propriétaire devrait
    // lire sous le bouton : c'est un défaut. L'avaler ici la masquerait — au même titre
    // que la redirection de requireAdmin(), qui s'implémente par un throw.
    const error = await changeStatusFromForm(
      'commande-totalement-inexistante',
      'cancelled',
      initialStatusChangeState,
      new FormData(),
    ).then(() => null, (e: unknown) => e)

    // On NOMME l'erreur attendue. Un `rejects.toThrow()` sans argument passerait pour
    // n'importe quel rejet — OutOfStockError et ForbiddenTransitionError compris, c'est-à-dire
    // précisément les deux erreurs que cette action est censée TRADUIRE au lieu de les laisser
    // remonter : le test ne distinguerait donc pas le comportement voulu de son contraire.
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2025')
    expect(error).not.toBeInstanceOf(OrderError)
  })
})
