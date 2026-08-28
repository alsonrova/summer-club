import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { prisma } from '@/server/db'
import { ProduitIntrouvableError } from '@/server/reviews'

// Mêmes doublures que tests/admin/produits-actions.test.ts : requireAdmin() lit une session
// via next/headers et revalidatePath() exige un contexte de requête App Router — ni l'un ni
// l'autre n'existe sous Vitest. revalidatePath n'a rien à faire ici, seulement à ne pas lever.
vi.mock('@/server/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { email: 'admin@test.dev' } }),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { importerTemoignage, epinglerAvis, modererAvis } = await import('@/app/admin/avis/actions')

const SLUG_CATEGORIE = 'test-avis-categorie'
const SLUG_PRODUIT = 'test-avis-produit'
const AUTEUR = 'Autrice de test (avis)'

let productId: string
// Bornes du nettoyage : ce fichier ne supprime QUE les avis qu'il a créés, et QUE les
// lignes d'audit qui les concernent. La table Review et le journal d'audit sont des états
// globaux qu'il ne possède pas.
const idsAvis: string[] = []

async function creerAvisDeTest(donnees: {
  note?: number
  statut?: 'en_attente' | 'publie' | 'rejete'
  epingle?: boolean
  source?: 'verifie' | 'importe'
}) {
  const avis = await prisma.review.create({
    data: {
      productId,
      auteur: AUTEUR,
      note: donnees.note ?? 5,
      texte: 'Très joli collier, livré rapidement.',
      source: donnees.source ?? 'importe',
      statut: donnees.statut ?? 'en_attente',
      epingle: donnees.epingle ?? false,
    },
  })
  idsAvis.push(avis.id)
  return avis
}

beforeAll(async () => {
  const categorie = await prisma.category.upsert({
    where: { slug: SLUG_CATEGORIE },
    update: {},
    create: { slug: SLUG_CATEGORIE, nom: 'Catégorie de test (avis)', ordre: 998 },
  })
  const produit = await prisma.product.upsert({
    where: { slug: SLUG_PRODUIT },
    update: { categoryId: categorie.id },
    create: {
      slug: SLUG_PRODUIT,
      nom: 'Produit de test (avis)',
      description: 'Jeu de données réservé à tests/admin/avis-actions.test.ts.',
      categoryId: categorie.id,
      prixBase: 45000,
    },
  })
  productId = produit.id
  // Défensif : une exécution précédente interrompue a pu laisser des avis derrière elle.
  await prisma.review.deleteMany({ where: { productId } })
})

afterEach(async () => {
  if (idsAvis.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entite: 'Review', entiteId: { in: idsAvis } } })
    await prisma.review.deleteMany({ where: { id: { in: idsAvis } } })
    idsAvis.length = 0
  }
  // Rattrape aussi les avis créés par importerTemoignage, dont l'identifiant n'est pas
  // toujours poussé dans idsAvis (un test qui échoue avant).
  const restants = await prisma.review.findMany({ where: { productId }, select: { id: true } })
  if (restants.length > 0) {
    const ids = restants.map((a) => a.id)
    await prisma.auditLog.deleteMany({ where: { entite: 'Review', entiteId: { in: ids } } })
    await prisma.review.deleteMany({ where: { id: { in: ids } } })
  }
})

afterAll(async () => {
  await prisma.product.deleteMany({ where: { slug: SLUG_PRODUIT } })
  await prisma.category.deleteMany({ where: { slug: SLUG_CATEGORIE } })
  await prisma.$disconnect()
})

describe('importerTemoignage', () => {
  it("crée l'avis en source « importe », jamais « verifie »", async () => {
    const avis = await importerTemoignage({
      productId,
      note: 5,
      texte: 'Reçu par WhatsApp, recopié à la main.',
      auteur: AUTEUR,
    })
    idsAvis.push(avis.id)

    // C'est l'invariant central de l'écran : le badge « Achat vérifié » n'appartient qu'aux
    // avis réellement rattachés à une commande livrée.
    expect(avis.source).toBe('importe')
    expect(avis.orderId).toBeNull()
    // Saisi par la propriétaire elle-même : inutile de le faire passer par sa propre file
    // de modération.
    expect(avis.statut).toBe('publie')
  })

  it("ignore un « source: verifie » glissé dans les données d'entrée", async () => {
    // Le schéma Zod ne déclare pas `source` : zod retire les clés inconnues, et l'action
    // fixe la valeur elle-même. Sans cela, un appelant pourrait fabriquer le badge.
    const avis = await importerTemoignage({
      productId,
      note: 5,
      texte: 'Tentative de forge du badge de vérification.',
      auteur: AUTEUR,
      source: 'verifie',
      statut: 'publie',
      orderId: 'commande-forgee',
    })
    idsAvis.push(avis.id)

    expect(avis.source).toBe('importe')
    expect(avis.orderId).toBeNull()
  })

  it('accepte un témoignage sans produit rattaché', async () => {
    const avis = await importerTemoignage({
      productId: null,
      note: 4,
      texte: 'Un mot laissé en boutique, sans produit précis.',
      auteur: AUTEUR,
    })
    idsAvis.push(avis.id)
    expect(avis.productId).toBeNull()
  })

  it('refuse une note hors de 1..5 et un texte trop court', async () => {
    await expect(
      importerTemoignage({ productId, note: 6, texte: 'Correct assez', auteur: AUTEUR }),
    ).rejects.toThrow()
    await expect(
      importerTemoignage({ productId, note: 5, texte: 'ok', auteur: AUTEUR }),
    ).rejects.toThrow()
    expect(await prisma.review.count({ where: { productId } })).toBe(0)
  })

  it("refuse un produit inexistant avec un message français, pas une violation de clé étrangère", async () => {
    await expect(
      importerTemoignage({
        productId: 'produit-totalement-inexistant',
        note: 5,
        texte: 'Un témoignage sur un produit fantôme.',
        auteur: AUTEUR,
      }),
    ).rejects.toBeInstanceOf(ProduitIntrouvableError)
  })

  it("journalise l'import dans le journal d'audit", async () => {
    const avis = await importerTemoignage({
      productId, note: 5, texte: 'Un témoignage à journaliser.', auteur: AUTEUR,
    })
    idsAvis.push(avis.id)

    const traces = await prisma.auditLog.findMany({
      where: { entite: 'Review', entiteId: avis.id },
    })
    expect(traces).toHaveLength(1)
    expect(traces[0]!.action).toBe('importer_temoignage')
    expect(traces[0]!.acteur).toBe('admin@test.dev')
  })
})

describe('epinglerAvis', () => {
  it("bascule la mise en avant sur la page d'accueil, dans les deux sens", async () => {
    const avis = await creerAvisDeTest({ statut: 'publie' })
    expect(avis.epingle).toBe(false)

    expect((await epinglerAvis(avis.id, true)).epingle).toBe(true)
    expect((await epinglerAvis(avis.id, false)).epingle).toBe(false)
  })

  it('journalise la valeur avant et après', async () => {
    const avis = await creerAvisDeTest({ statut: 'publie' })
    await epinglerAvis(avis.id, true)

    const traces = await prisma.auditLog.findMany({
      where: { entite: 'Review', entiteId: avis.id, action: 'epingler_avis' },
    })
    expect(traces).toHaveLength(1)
    expect(traces[0]!.avant).toEqual({ epingle: false })
    expect(traces[0]!.apres).toEqual({ epingle: true })
  })
})

describe('modererAvis', () => {
  it('publie un avis en attente', async () => {
    const avis = await creerAvisDeTest({ statut: 'en_attente' })
    expect((await modererAvis(avis.id, 'publie')).statut).toBe('publie')
  })

  it("dépingle un avis qu'on rejette, pour ne pas laisser un avis épinglé hors vitrine", async () => {
    const avis = await creerAvisDeTest({ statut: 'publie', epingle: true })
    const apres = await modererAvis(avis.id, 'rejete')
    expect(apres.statut).toBe('rejete')
    expect(apres.epingle).toBe(false)
  })

  it("ne change pas la source d'un avis vérifié qu'on modère", async () => {
    const avis = await creerAvisDeTest({ statut: 'en_attente', source: 'verifie' })
    expect((await modererAvis(avis.id, 'publie')).source).toBe('verifie')
  })
})
