import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/server/db'
import { listerProduitsPagines, PRODUITS_PAR_PAGE } from '@/app/admin/produits/query'

// Vérifie que la liste admin interroge réellement la base (skip/take + comptage), plutôt
// que de charger tout le catalogue en mémoire pour le découper ensuite en JavaScript — un
// piège explicitement signalé pour cette tâche (AdminTable est un composant de
// présentation, la pagination reste à écrire).
const PREFIXE = 'pagtest-'
let categoryId: string

beforeAll(async () => {
  const categorie = await prisma.category.upsert({
    where: { slug: 'pagination-test' },
    update: {},
    create: { slug: 'pagination-test', nom: 'Pagination Test', ordre: 99 },
  })
  categoryId = categorie.id

  // Nettoyage défensif : une exécution précédente interrompue (Ctrl-C, crash worker)
  // peut avoir laissé des produits de test en base.
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIXE } } })

  const total = PRODUITS_PAR_PAGE + 5
  for (let i = 0; i < total; i++) {
    await prisma.product.create({
      data: {
        slug: `${PREFIXE}${i}`,
        nom: `Produit pagination ${i}`,
        description: 'Produit créé uniquement pour vérifier la pagination admin.',
        categoryId,
        prixBase: 10000,
        ordre: i,
      },
    })
  }
})

afterAll(async () => {
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIXE } } })
  await prisma.category.delete({ where: { id: categoryId } })
  await prisma.$disconnect()
})

describe('listerProduitsPagines', () => {
  it('interroge la base avec skip/take plutôt que de charger tout le catalogue', async () => {
    const espionFindMany = vi.spyOn(prisma.product, 'findMany')
    const espionCount = vi.spyOn(prisma.product, 'count')

    const resultat = await listerProduitsPagines(prisma.product, {
      page: 1,
      filtres: { categoryId },
    })

    expect(espionCount).toHaveBeenCalled()
    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: PRODUITS_PAR_PAGE }),
    )
    expect(resultat.lignes).toHaveLength(PRODUITS_PAR_PAGE)
    expect(resultat.totalPages).toBe(2)

    espionFindMany.mockRestore()
    espionCount.mockRestore()
  })

  it('renvoie la seconde page avec le reste des lignes, pas les mêmes', async () => {
    const page1 = await listerProduitsPagines(prisma.product, { page: 1, filtres: { categoryId } })
    const page2 = await listerProduitsPagines(prisma.product, { page: 2, filtres: { categoryId } })

    expect(page2.lignes).toHaveLength(5)
    expect(page2.page).toBe(2)
    const slugsPage1 = new Set(page1.lignes.map((l) => l.slug))
    for (const ligne of page2.lignes) {
      expect(slugsPage1.has(ligne.slug)).toBe(false)
    }
  })

  it('filtre par catégorie', async () => {
    const resultat = await listerProduitsPagines(prisma.product, {
      page: 1,
      filtres: { categoryId: 'categorie-totalement-inexistante' },
    })
    expect(resultat.lignes).toHaveLength(0)
    expect(resultat.totalPages).toBe(1)
  })

  it('affiche le nom de la catégorie plutôt que son identifiant brut', async () => {
    const resultat = await listerProduitsPagines(prisma.product, { page: 1, filtres: { categoryId } })
    expect(resultat.lignes[0]?.categoryId).toBe('Pagination Test')
  })

  it('ramène une page demandée hors bornes à la dernière page existante', async () => {
    const resultat = await listerProduitsPagines(prisma.product, { page: 999, filtres: { categoryId } })
    expect(resultat.page).toBe(resultat.totalPages)
    expect(resultat.lignes.length).toBeGreaterThan(0)
  })
})
