import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/server/db'
import { ajusterStock, televerserMedia, reordonnerMedia } from '@/app/admin/produits/actions'

// ajusterStock/televerserMedia/reordonnerMedia passent par requireAdmin() (session,
// next/headers) et revalidatePath() (cache App Router) : tous deux exigent un contexte de
// requête Next.js réel, absent sous Vitest. Même doublure que
// tests/admin/champs-systeme.test.ts pour requireAdmin ; revalidatePath n'a pas besoin de
// faire quoi que ce soit ici, seulement de ne pas lever.
vi.mock('@/server/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { email: 'admin@test.dev' } }),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Fixture dédiée à ce fichier plutôt que le produit/variante du seed (collier-vahine /
// VAH-45) : tests/server/orders.test.ts mute cette même variante en parallèle (vitest
// exécute les fichiers de test simultanément contre la même base), et les deux suites se
// marchaient dessus quand celle-ci réutilisait VAH-45.
const PREFIXE = 'admintest-'
let categoryId: string
let productId: string
let variantId: string

beforeAll(async () => {
  await prisma.variant.deleteMany({ where: { sku: { startsWith: PREFIXE } } })
  await prisma.media.deleteMany({ where: { product: { slug: { startsWith: PREFIXE } } } })
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIXE } } })
  await prisma.category.deleteMany({ where: { slug: `${PREFIXE}categorie` } })

  const categorie = await prisma.category.create({
    data: { slug: `${PREFIXE}categorie`, nom: 'Catégorie de test admin' },
  })
  categoryId = categorie.id

  const produit = await prisma.product.create({
    data: {
      slug: `${PREFIXE}produit`,
      nom: 'Produit de test admin',
      description: 'Produit créé uniquement pour les tests des actions admin.',
      categoryId,
      prixBase: 10000,
    },
  })
  productId = produit.id

  const variant = await prisma.variant.create({
    data: { productId, libelle: 'Unique', sku: `${PREFIXE}sku`, stock: 5 },
  })
  variantId = variant.id
})

afterAll(async () => {
  await prisma.variant.deleteMany({ where: { sku: { startsWith: PREFIXE } } })
  await prisma.media.deleteMany({ where: { productId } })
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIXE } } })
  await prisma.category.deleteMany({ where: { slug: `${PREFIXE}categorie` } })
  await prisma.$disconnect()
})

beforeEach(async () => {
  await prisma.variant.update({ where: { id: variantId }, data: { stock: 5 } })
  await prisma.auditLog.deleteMany({ where: { entite: { in: ['Variant', 'Media'] } } })
})

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [cle, valeur] of Object.entries(entries)) fd.set(cle, valeur)
  return fd
}

describe('ajusterStock', () => {
  it('refuse un stock non entier', async () => {
    const etat = await ajusterStock(variantId, { erreur: null }, formData({ stock: '4.5' }))
    expect(etat.erreur).toMatch(/entier/)
    const apres = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(apres.stock).toBe(5)
  })

  it('refuse un stock négatif', async () => {
    const etat = await ajusterStock(variantId, { erreur: null }, formData({ stock: '-1' }))
    expect(etat.erreur).toMatch(/positif|négatif/)
    const apres = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(apres.stock).toBe(5)
  })

  it('accepte un stock entier positif ou nul et écrit un journal avant/après', async () => {
    const etat = await ajusterStock(variantId, { erreur: null }, formData({ stock: '12' }))
    expect(etat.erreur).toBeNull()

    const apres = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(apres.stock).toBe(12)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entite: 'Variant', entiteId: variantId },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.avant).toEqual({ stock: 5 })
    expect(audit.apres).toEqual({ stock: 12 })
  })

  it('accepte un stock ramené à zéro', async () => {
    const etat = await ajusterStock(variantId, { erreur: null }, formData({ stock: '0' }))
    expect(etat.erreur).toBeNull()
    const apres = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(apres.stock).toBe(0)
  })
})

describe('televerserMedia', () => {
  it('refuse un type de fichier non autorisé sans créer de média', async () => {
    const avant = await prisma.media.count({ where: { productId } })

    const fichier = new File(['contenu texte'], 'notice.pdf', { type: 'application/pdf' })
    const fd = new FormData()
    fd.set('fichier', fichier)

    const etat = await televerserMedia(productId, { erreur: null }, fd)
    expect(etat.erreur).toMatch(/Format non accepté/)

    const apres = await prisma.media.count({ where: { productId } })
    expect(apres).toBe(avant)
  })

  it("refuse l'absence de fichier", async () => {
    const etat = await televerserMedia(productId, { erreur: null }, new FormData())
    expect(etat.erreur).toMatch(/Aucun fichier/)
  })
})

describe('reordonnerMedia', () => {
  it('refuse une position négative', async () => {
    const etat = await reordonnerMedia('media-inexistant', { erreur: null }, formData({ position: '-1' }))
    expect(etat.erreur).toMatch(/entier|positif/)
  })

  it('refuse une position non entière', async () => {
    const etat = await reordonnerMedia('media-inexistant', { erreur: null }, formData({ position: '1.5' }))
    expect(etat.erreur).toMatch(/entier/)
  })
})
