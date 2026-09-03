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
const SLUG_CATEGORIE = 'test-cmd-actions-categorie'
const SLUG_PRODUIT = 'test-cmd-actions-produit'
const SKU = 'CMDACT-45'

const client = { customerName: 'Cliente de test (actions commandes)', phone: '0320000000' }

let variantId: string

/** Toutes les commandes de ce fichier — et elles seules — portent cette déclinaison. */
async function purgerMesCommandes() {
  const miennes = await prisma.order.findMany({
    where: { items: { some: { variantId } } },
    select: { id: true },
  })
  const ids = miennes.map((o) => o.id)
  if (ids.length === 0) return
  // Bornée à mes propres identifiants : le journal d'audit est une table globale que ce
  // fichier ne possède pas, on n'y touche que les lignes qu'on y a écrites.
  await prisma.auditLog.deleteMany({ where: { entite: 'Order', entiteId: { in: ids } } })
  await prisma.order.deleteMany({ where: { id: { in: ids } } })
}

// Idempotent : la suite repart d'une base laissée dans n'importe quel état par une
// exécution interrompue (Ctrl-C, crash du worker), sans intervention manuelle.
beforeAll(async () => {
  const categorie = await prisma.category.upsert({
    where: { slug: SLUG_CATEGORIE },
    update: {},
    create: { slug: SLUG_CATEGORIE, nom: 'Catégorie de test (actions commandes)', ordre: 997 },
  })
  const produit = await prisma.product.upsert({
    where: { slug: SLUG_PRODUIT },
    update: { actif: true, prixBase: 45000, categoryId: categorie.id },
    create: {
      slug: SLUG_PRODUIT,
      nom: 'Produit de test (actions commandes)',
      description: 'Jeu de données réservé à tests/admin/commandes-actions.test.ts.',
      categoryId: categorie.id,
      prixBase: 45000,
      prixAchat: 18000,
    },
  })
  const variante = await prisma.variant.upsert({
    where: { sku: SKU },
    update: { stock: 10, deltaPrix: 0, productId: produit.id },
    create: { productId: produit.id, libelle: '45 cm', sku: SKU, stock: 10 },
  })
  variantId = variante.id
})

beforeEach(async () => {
  await purgerMesCommandes()
  await prisma.variant.update({ where: { id: variantId }, data: { stock: 10 } })
  vi.mocked(revalidatePath).mockClear()
})

afterEach(async () => {
  await purgerMesCommandes()
  // `vitest.config.ts` n'active pas `restoreMocks` : sans ceci, un espion posé par un test
  // qui échoue avant son propre nettoyage resterait posé pour les suivants.
  vi.restoreAllMocks()
})

// Rend la base à l'état où ce fichier l'a trouvée : ses commandes, sa catégorie, son
// produit et sa déclinaison (supprimée en cascade avec le produit, voir prisma/schema.prisma)
// disparaissent. Un fichier qui ne nettoie qu'au DÉBUT de chaque test laisse toujours les
// données de son dernier test derrière lui.
afterAll(async () => {
  await purgerMesCommandes()
  await prisma.product.deleteMany({ where: { slug: SLUG_PRODUIT } })
  await prisma.category.deleteMany({ where: { slug: SLUG_CATEGORIE } })
  await prisma.$disconnect()
})

async function commandeWhatsapp(quantity: number) {
  return createOrder({
    lines: [{ variantId, quantity }],
    channel: 'whatsapp',
    client,
    zoneId: null,
    isMember: false,
  })
}

async function commandeConfirmee(quantity: number) {
  return createOrder({
    lines: [{ variantId, quantity }],
    channel: 'livraison',
    client,
    zoneId: null,
    isMember: false,
  })
}

describe('changeStatus — garde de type sur le statut', () => {
  it("refuse un statut forgé avant qu'il n'atteigne l'énumération PostgreSQL", async () => {
    const c = await commandeConfirmee(1)

    // Une Server Action exportée est une route publique : protégée par requireAdmin(),
    // mais pas typée à l'exécution.
    await expect(changeStatus(c.id, 'supprimee' as never)).rejects.toThrow(
      'Statut inconnu : supprimee',
    )

    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).statut).toBe(
      'confirmee',
    )
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(9)
  })
})

describe('changeStatus — chemin nominal', () => {
  it('applique la transition et invalide tous les chemins publiés par le cœur métier', async () => {
    const c = await commandeWhatsapp(2)

    await changeStatus(c.id, 'confirmee')

    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).statut).toBe(
      'confirmee',
    )
    // La liste vient du module métier, elle n'est pas recopiée ici : c'est ce qui garantit
    // qu'aucun chemin ajouté à `pathsToRevalidate` ne sera oublié par l'action.
    for (const chemin of pathsToRevalidate(c.id)) {
      expect(revalidatePath).toHaveBeenCalledWith(chemin)
    }
  })
})

describe('changeStatusFromForm — traduction des erreurs métier', () => {
  it("traduit une transition devenue impossible en français, avec les libellés d'écran", async () => {
    const c = await commandeConfirmee(2)

    // confirmee → livree n'est pas une transition déclarée : c'est ce que voit un onglet
    // resté sur un rendu périmé.
    const etat = await changeStatusFromForm(
      c.id,
      'livree',
      initialStatusChangeState,
      new FormData(),
    )

    expect(etat.error).toContain('« Confirmée »')
    expect(etat.error).toContain('« Livrée »')
    expect(etat.error).toContain('Rechargez la page.')
    // Ni valeur brute d'énumération, ni nom de classe d'erreur sous les yeux de la
    // propriétaire.
    expect(etat.error).not.toMatch(/confirmee|livree|ForbiddenTransition/)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).statut).toBe(
      'confirmee',
    )
  })

  it('traduit une rupture de stock en français plutôt que de la laisser remonter', async () => {
    // Une commande WhatsApp ne réserve rien : le stock peut partir entre la prise de
    // commande et son acceptation.
    const c = await commandeWhatsapp(3)
    await prisma.variant.update({ where: { id: variantId }, data: { stock: 1 } })

    const etat = await changeStatusFromForm(
      c.id,
      'confirmee',
      initialStatusChangeState,
      new FormData(),
    )

    expect(etat.error).toContain('Stock insuffisant')
    expect(etat.error).toContain('Réapprovisionnez')
    expect(etat.error).not.toMatch(/OutOfStock|prisma|constraint/i)
    // Refusée avant toute écriture : ni stock entamé, ni statut avancé à tort.
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(1)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).statut).toBe(
      'en_attente_confirmation',
    )
  })

  it('rend { error: null } quand la transition passe', async () => {
    const c = await commandeWhatsapp(2)

    const etat = await changeStatusFromForm(
      c.id,
      'confirmee',
      initialStatusChangeState,
      new FormData(),
    )

    expect(etat).toEqual({ error: null })
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).statut).toBe(
      'confirmee',
    )
  })

  it('laisse remonter une panne technique au lieu de la déguiser en message métier', async () => {
    // Une commande inexistante n'est pas une situation normale que la propriétaire devrait
    // lire sous le bouton : c'est un défaut. L'avaler ici la masquerait — au même titre
    // que la redirection de requireAdmin(), qui s'implémente par un throw.
    const erreur = await changeStatusFromForm(
      'commande-totalement-inexistante',
      'annulee',
      initialStatusChangeState,
      new FormData(),
    ).then(() => null, (e: unknown) => e)

    // On NOMME l'erreur attendue. Un `rejects.toThrow()` sans argument passerait pour
    // n'importe quel rejet — OutOfStockError et ForbiddenTransitionError compris, c'est-à-dire
    // précisément les deux erreurs que cette action est censée TRADUIRE au lieu de les laisser
    // remonter : le test ne distinguerait donc pas le comportement voulu de son contraire.
    expect(erreur).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((erreur as Prisma.PrismaClientKnownRequestError).code).toBe('P2025')
    expect(erreur).not.toBeInstanceOf(OrderError)
  })
})
