import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@/server/db'
import {
  listReviewsPaginated,
  REVIEWS_PER_PAGE,
  type ReviewListDelegate,
} from '@/app/admin/avis/query'

// Pendant de tests/admin/commandes-query.test.ts pour les avis : vérifie que la liste
// interroge réellement la base (comptage + skip/take) au lieu de charger toute la table pour
// la découper en mémoire, que son tri est TOTAL donc déterministe, et que ses deux filtres
// fonctionnent — y compris `pinned: false`, qu'un `if (filters.pinned)` naïf laisserait
// tomber.
//
// La table Review est un état global que ce fichier ne possède pas, et `ReviewFilters`
// n'offre aucun filtre par produit pour s'y borner. C'est le DELEGATE injecté qui joue ce
// rôle : `listReviewsPaginated` prend son delegate en paramètre, on lui en passe un qui
// ajoute `productId` à chaque `where`. Les avis des autres fichiers, qui tournent en
// parallèle (vitest.config.ts), restent invisibles d'ici — et ceux d'ici invisibles d'eux.
const CATEGORY_SLUG = 'test-avis-query-categorie'
const PRODUCT_SLUG = 'test-avis-query-produit'
const PRODUCT_NAME = 'Produit de test (liste des avis)'
const TOTAL = REVIEWS_PER_PAGE + 5
const PINNED_COUNT = 3

// Horodatage identique pour tous : c'est le cas réel qui casse un tri sur `createdAt` seul
// (un import, une rafale). Voir le test de stabilité plus bas.
const SAME_INSTANT = new Date('2026-08-01T10:00:00.000Z')

let productId: string

function statusOf(i: number): 'pending' | 'published' | 'rejected' {
  if (i < PINNED_COUNT) return 'published'
  return i % 3 === 0 ? 'published' : i % 3 === 1 ? 'pending' : 'rejected'
}

async function purge() {
  const mine = await prisma.review.findMany({ where: { productId }, select: { id: true } })
  const ids = mine.map((a) => a.id)
  if (ids.length === 0) return
  await prisma.auditLog.deleteMany({ where: { entity: 'Review', entityId: { in: ids } } })
  await prisma.review.deleteMany({ where: { id: { in: ids } } })
}

/** Delegate borné à MES avis — voir l'en-tête de fichier. */
function myReviews(): ReviewListDelegate {
  return {
    count: ({ where }) => prisma.review.count({ where: { ...where, productId } }),
    findMany: (args) => prisma.review.findMany({ ...args, where: { ...args.where, productId } }),
  }
}

beforeAll(async () => {
  const category = await prisma.category.upsert({
    where: { slug: CATEGORY_SLUG },
    update: {},
    create: { slug: CATEGORY_SLUG, name: 'Catégorie de test (liste des avis)', displayOrder: 996 },
  })
  const product = await prisma.product.upsert({
    where: { slug: PRODUCT_SLUG },
    update: { name: PRODUCT_NAME, categoryId: category.id },
    create: {
      slug: PRODUCT_SLUG,
      name: PRODUCT_NAME,
      description: 'Jeu de données réservé à tests/admin/avis-query.test.ts.',
      categoryId: category.id,
      basePrice: 45000,
    },
  })
  productId = product.id

  // Défensif : rattrape une exécution précédente interrompue (Ctrl-C, crash du worker), de
  // sorte que la suite reparte d'une base laissée dans n'importe quel état.
  await purge()

  for (let i = 0; i < TOTAL; i++) {
    await prisma.review.create({
      data: {
        productId,
        author: `Autrice ${String(i).padStart(2, '0')}`,
        rating: (i % 5) + 1,
        body: 'Très joli collier, livré rapidement.',
        source: i % 2 === 0 ? 'imported' : 'verified',
        status: statusOf(i),
        pinned: i < PINNED_COUNT,
        createdAt: SAME_INSTANT,
      },
    })
  }
})

afterAll(async () => {
  await purge()
  await prisma.product.deleteMany({ where: { slug: PRODUCT_SLUG } })
  await prisma.category.deleteMany({ where: { slug: CATEGORY_SLUG } })
  await prisma.$disconnect()
})

// `vitest.config.ts` n'active pas `restoreMocks` : un `mockRestore()` en fin de test ne
// s'exécuterait pas si une assertion échouait avant lui, et l'espion resterait posé sur
// `prisma.review` pour les tests suivants du fichier.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('listReviewsPaginated', () => {
  it('interroge la base avec skip/take plutôt que de charger tous les avis', async () => {
    const espionFindMany = vi.spyOn(prisma.review, 'findMany')
    const espionCount = vi.spyOn(prisma.review, 'count')

    const result = await listReviewsPaginated(myReviews(), { page: 1 })

    expect(espionCount).toHaveBeenCalled()
    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: REVIEWS_PER_PAGE }),
    )
    expect(result.rows).toHaveLength(REVIEWS_PER_PAGE)
    expect(result.total).toBe(TOTAL)
    expect(result.totalPages).toBe(2)
  })

  it('décale bien skip sur la seconde page', async () => {
    const espionFindMany = vi.spyOn(prisma.review, 'findMany')

    const result = await listReviewsPaginated(myReviews(), { page: 2 })

    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: REVIEWS_PER_PAGE, take: REVIEWS_PER_PAGE }),
    )
    expect(result.rows).toHaveLength(TOTAL - REVIEWS_PER_PAGE)
    expect(result.page).toBe(2)
  })

  it("trie sur une clé unique en dernier critère, sans quoi un même avis peut sortir sur deux pages", async () => {
    // L'espion est ce qui donne sa valeur protectrice à ce test : les 25 avis partagent le
    // même `createdAt`, mais PostgreSQL renvoie en pratique un ordre stable tant que rien ne
    // le perturbe — un retour en arrière sur le dernier critère de tri ne serait donc pas
    // détecté par les seules lignes obtenues.
    const espionFindMany = vi.spyOn(prisma.review, 'findMany')

    const page1 = await listReviewsPaginated(myReviews(), { page: 1 })
    const page2 = await listReviewsPaginated(myReviews(), { page: 2 })

    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
    )

    const ids = [...page1.rows.map((l) => l.id), ...page2.rows.map((l) => l.id)]
    // Ni doublon d'une page à l'autre, ni ligne oubliée.
    expect(new Set(ids).size).toBe(TOTAL)
  })

  it("place les avis épinglés en tête, c'est ce que la propriétaire vient vérifier", async () => {
    const page1 = await listReviewsPaginated(myReviews(), { page: 1 })

    expect(page1.rows.slice(0, PINNED_COUNT).every((l) => l.pinned)).toBe(true)
    expect(page1.rows.slice(PINNED_COUNT).some((l) => l.pinned)).toBe(false)
  })

  it('filtre par statut', async () => {
    const expected = await prisma.review.count({ where: { productId, status: 'rejected' } })
    expect(expected).toBeGreaterThan(0)

    const result = await listReviewsPaginated(myReviews(), { page: 1, filters: { status: 'rejected' } })

    expect(result.total).toBe(expected)
    expect(result.rows.every((l) => l.status === 'rejected')).toBe(true)
  })

  it('filtre par épinglage, dans les deux sens', async () => {
    const pinnedOnly = await listReviewsPaginated(myReviews(), { page: 1, filters: { pinned: true } })
    expect(pinnedOnly.total).toBe(PINNED_COUNT)
    expect(pinnedOnly.rows.every((l) => l.pinned)).toBe(true)

    // `pinned: false` est le cas qu'un `if (filters.pinned)` laisserait tomber : la valeur
    // est falsy, mais elle a bien été demandée. D'où le `!== undefined` dans la requête.
    const notPinned = await listReviewsPaginated(myReviews(), { page: 1, filters: { pinned: false } })
    expect(notPinned.total).toBe(TOTAL - PINNED_COUNT)
    expect(notPinned.rows.some((l) => l.pinned)).toBe(false)
  })

  it('combine les deux filtres', async () => {
    const expected = await prisma.review.count({
      where: { productId, status: 'published', pinned: false },
    })
    expect(expected).toBeGreaterThan(0)

    const result = await listReviewsPaginated(myReviews(), {
      page: 1,
      filters: { status: 'published', pinned: false },
    })

    expect(result.total).toBe(expected)
    expect(result.rows.every((l) => l.status === 'published' && !l.pinned)).toBe(true)
  })

  it('ramène une page demandée hors bornes à la dernière page existante', async () => {
    const result = await listReviewsPaginated(myReviews(), { page: 999 })

    expect(result.page).toBe(result.totalPages)
    expect(result.rows.length).toBeGreaterThan(0)
  })

  it("expose le nom du produit rattaché plutôt que son identifiant technique", async () => {
    const result = await listReviewsPaginated(myReviews(), { page: 1 })

    expect(result.rows.every((l) => l.product === PRODUCT_NAME)).toBe(true)
  })
})
