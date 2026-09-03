import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@/server/db'
import { listProductsPaginated, PRODUCTS_PER_PAGE } from '@/app/admin/produits/query'

// Vérifie que la liste admin interroge réellement la base (skip/take + comptage), plutôt
// que de charger tout le catalogue en mémoire pour le découper ensuite en JavaScript — un
// piège explicitement signalé pour cette tâche (AdminTable est un composant de
// présentation, la pagination reste à écrire).
const PREFIXE = 'pagtest-'
let categoryId: string

beforeAll(async () => {
  const category = await prisma.category.upsert({
    where: { slug: 'pagination-test' },
    update: {},
    create: { slug: 'pagination-test', name: 'Pagination Test', displayOrder: 99 },
  })
  categoryId = category.id

  // Nettoyage défensif : une exécution précédente interrompue (Ctrl-C, crash worker)
  // peut avoir laissé des produits de test en base.
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIXE } } })

  // Un seul aller-retour pour les 25 lignes : la version en boucle (25 `create` séquentiels)
  // dépassait le délai de garde de 10 s de Vitest sur une machine chargée ou à froid —
  // 8 fichiers rougissaient d'un coup, symptôme trompeur d'une régression (observé le
  // 2026-08-30, consigné dans la passation des tâches 1 à 12).
  const total = PRODUCTS_PER_PAGE + 5
  await prisma.product.createMany({
    data: Array.from({ length: total }, (_, i) => ({
      slug: `${PREFIXE}${i}`,
      name: `Produit pagination ${i}`,
      description: 'Produit créé uniquement pour vérifier la pagination admin.',
      categoryId,
      basePrice: 10000,
      displayOrder: i,
    })),
  })
})

afterAll(async () => {
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIXE } } })
  await prisma.category.delete({ where: { id: categoryId } })
  await prisma.$disconnect()
})

// Restauration systématique, et non en dernière instruction d'un test : `vitest.config.ts`
// n'active pas `restoreMocks`, et un `mockRestore()` placé en fin de test (ou avant les
// dernières assertions) ne s'exécute pas si une assertion échoue avant lui — l'espion
// resterait alors actif sur `prisma.product` pour les tests suivants du même fichier.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('listProductsPaginated', () => {
  it('interroge la base avec skip/take plutôt que de charger tout le catalogue', async () => {
    const espionFindMany = vi.spyOn(prisma.product, 'findMany')
    const espionCount = vi.spyOn(prisma.product, 'count')

    const result = await listProductsPaginated(prisma.product, {
      page: 1,
      filters: { categoryId },
    })

    expect(espionCount).toHaveBeenCalled()
    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: PRODUCTS_PER_PAGE }),
    )
    expect(result.rows).toHaveLength(PRODUCTS_PER_PAGE)
    expect(result.totalPages).toBe(2)
  })

  it('renvoie la seconde page avec le reste des lignes, pas les mêmes', async () => {
    const page1 = await listProductsPaginated(prisma.product, { page: 1, filters: { categoryId } })
    const page2 = await listProductsPaginated(prisma.product, { page: 2, filters: { categoryId } })

    expect(page2.rows).toHaveLength(5)
    expect(page2.page).toBe(2)
    const page1Slugs = new Set(page1.rows.map((l) => l.slug))
    for (const row of page2.rows) {
      expect(page1Slugs.has(row.slug)).toBe(false)
    }
  })

  it('filtre par catégorie', async () => {
    const result = await listProductsPaginated(prisma.product, {
      page: 1,
      filters: { categoryId: 'categorie-totalement-inexistante' },
    })
    expect(result.rows).toHaveLength(0)
    expect(result.totalPages).toBe(1)
  })

  it('affiche le nom de la catégorie plutôt que son identifiant brut', async () => {
    const result = await listProductsPaginated(prisma.product, { page: 1, filters: { categoryId } })
    expect(result.rows[0]?.categoryId).toBe('Pagination Test')
  })

  it('ramène une page demandée hors bornes à la dernière page existante', async () => {
    const result = await listProductsPaginated(prisma.product, { page: 999, filters: { categoryId } })
    expect(result.page).toBe(result.totalPages)
    expect(result.rows.length).toBeGreaterThan(0)
  })
})

// Reproduit le cas réel plutôt que celui, artificiel, du bloc ci-dessus : un produit créé
// depuis l'interface d'administration n'a aucune raison de porter un `ordre` distinct — le
// formulaire par défaut à 0 (voir formulaire-produit.tsx). Avec cette clé de tri
// intégralement constante, `orderBy: { ordre: 'asc' }` seul ne garantit aucun ordre stable
// entre deux requêtes PostgreSQL : `skip`/`take` peut alors dupliquer une ligne d'une page
// à l'autre et en oublier une autre. Ce bloc vérifie qu'aucune ligne ne se retrouve sur
// deux pages, ni ne disparaît, avec un `ordre` identique pour tous les produits — via un
// second critère de tri déterministe (`id`), pas via des valeurs d'`ordre` distinctes que
// l'interface ne produit jamais.
describe('listProductsPaginated avec un `ordre` identique pour tous les produits (cas réel)', () => {
  const PREFIXE_ORDRE_CONSTANT = 'pagtest-ordre-constant-'
  let categoryIdOrdreConstant: string

  beforeAll(async () => {
    const category = await prisma.category.upsert({
      where: { slug: 'pagination-test-ordre-constant' },
      update: {},
      create: { slug: 'pagination-test-ordre-constant', name: 'Pagination Test Ordre Constant', displayOrder: 98 },
    })
    categoryIdOrdreConstant = category.id

    await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIXE_ORDRE_CONSTANT } } })

    // Même correctif que le beforeAll du bloc précédent : un seul `createMany` plutôt que
    // 25 allers-retours séquentiels sous le délai de garde de 10 s de Vitest.
    const total = PRODUCTS_PER_PAGE + 5
    await prisma.product.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        slug: `${PREFIXE_ORDRE_CONSTANT}${i}`,
        name: `Produit ordre constant ${i}`,
        description: 'Produit créé uniquement pour vérifier la stabilité de la pagination.',
        categoryId: categoryIdOrdreConstant,
        basePrice: 10000,
        // Valeur constante volontaire : c'est le cas réel, tout produit créé depuis
        // l'interface a `ordre: 0` (défaut Prisma, jamais exposé au formulaire avant
        // ce correctif — voir formulaire-produit.tsx).
        displayOrder: 0,
      })),
    })
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIXE_ORDRE_CONSTANT } } })
    await prisma.category.delete({ where: { id: categoryIdOrdreConstant } })
  })

  it("ne duplique et n'oublie aucune ligne entre deux pages quand `ordre` est identique pour tous les produits", async () => {
    // L'espion est ce qui donne sa valeur protectrice à ce test : sans lui, il passerait
    // à l'identique avec un `orderBy: { ordre: 'asc' }` seul, PostgreSQL renvoyant en
    // pratique un ordre stable tant que rien ne le perturbe — un retour en arrière sur le
    // second critère de tri ne serait donc pas détecté. Assertion sur la clé de tri
    // réellement transmise à Prisma, pas seulement sur les lignes obtenues.
    const espionFindMany = vi.spyOn(prisma.product, 'findMany')

    const page1 = await listProductsPaginated(prisma.product, {
      page: 1,
      filters: { categoryId: categoryIdOrdreConstant },
    })
    const page2 = await listProductsPaginated(prisma.product, {
      page: 2,
      filters: { categoryId: categoryIdOrdreConstant },
    })

    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] }),
    )

    expect(page1.rows).toHaveLength(PRODUCTS_PER_PAGE)
    expect(page2.rows).toHaveLength(5)

    const idsPage1 = page1.rows.map((l) => l.id)
    const idsPage2 = page2.rows.map((l) => l.id)

    // Aucun chevauchement entre les deux pages...
    for (const id of idsPage2) {
      expect(idsPage1.includes(id)).toBe(false)
    }
    // ...et l'ensemble des deux pages couvre bien tous les produits créés, sans doublon ni
    // absent.
    const tousLesIds = new Set([...idsPage1, ...idsPage2])
    expect(tousLesIds.size).toBe(PRODUCTS_PER_PAGE + 5)
  })
})
