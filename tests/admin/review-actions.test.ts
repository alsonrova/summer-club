import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import {
  ReviewError,
  ReviewNotPublishedError,
  InvalidPinError,
  ProductNotFoundError,
  InvalidReviewStatusError,
} from '@/server/reviews'
import { initialReviewActionState } from '@/app/admin/avis/states'

// Mêmes doublures que tests/admin/product-actions.test.ts : requireAdmin() lit une session
// via next/headers et revalidatePath() exige un contexte de requête App Router — ni l'un ni
// l'autre n'existe sous Vitest. revalidatePath n'a rien à faire ici, seulement à ne pas lever.
vi.mock('@/server/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { email: 'admin@test.dev' } }),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const {
  importTestimonial,
  pinReview,
  pinReviewFromForm,
  moderateReview,
  moderateReviewFromForm,
} = await import('@/app/admin/avis/actions')

const CATEGORY_SLUG = 'test-avis-categorie'
const PRODUCT_SLUG = 'test-avis-produit'
const AUTHOR = 'Autrice de test (avis)'

let productId: string
// Bornes du nettoyage : ce fichier ne supprime QUE les avis qu'il a créés, et QUE les
// lignes d'audit qui les concernent. La table Review et le journal d'audit sont des états
// globaux qu'il ne possède pas.
const reviewIds: string[] = []

async function createTestReview(data: {
  rating?: number
  status?: 'pending' | 'published' | 'rejected'
  pinned?: boolean
  source?: 'verified' | 'imported'
}) {
  const review = await prisma.review.create({
    data: {
      productId,
      author: AUTHOR,
      rating: data.rating ?? 5,
      body: 'Très joli collier, livré rapidement.',
      source: data.source ?? 'imported',
      status: data.status ?? 'pending',
      pinned: data.pinned ?? false,
    },
  })
  reviewIds.push(review.id)
  return review
}

beforeAll(async () => {
  const category = await prisma.category.upsert({
    where: { slug: CATEGORY_SLUG },
    update: {},
    create: { slug: CATEGORY_SLUG, name: 'Catégorie de test (avis)', displayOrder: 998 },
  })
  const product = await prisma.product.upsert({
    where: { slug: PRODUCT_SLUG },
    update: { categoryId: category.id },
    create: {
      slug: PRODUCT_SLUG,
      name: 'Produit de test (avis)',
      description: 'Jeu de données réservé à tests/admin/review-actions.test.ts.',
      categoryId: category.id,
      basePrice: 45000,
    },
  })
  productId = product.id
  // Défensif : une exécution précédente interrompue a pu laisser des avis derrière elle.
  await prisma.review.deleteMany({ where: { productId } })
})

afterEach(async () => {
  if (reviewIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity: 'Review', entityId: { in: reviewIds } } })
    await prisma.review.deleteMany({ where: { id: { in: reviewIds } } })
    reviewIds.length = 0
  }
  // Rattrape aussi les avis créés par importTestimonial, dont l'identifiant n'est pas
  // toujours poussé dans idsAvis (un test qui échoue avant).
  const remaining = await prisma.review.findMany({ where: { productId }, select: { id: true } })
  if (remaining.length > 0) {
    const ids = remaining.map((a) => a.id)
    await prisma.auditLog.deleteMany({ where: { entity: 'Review', entityId: { in: ids } } })
    await prisma.review.deleteMany({ where: { id: { in: ids } } })
  }
})

afterAll(async () => {
  await prisma.product.deleteMany({ where: { slug: PRODUCT_SLUG } })
  await prisma.category.deleteMany({ where: { slug: CATEGORY_SLUG } })
  await prisma.$disconnect()
})

describe('importTestimonial', () => {
  it("crée l'avis en source « importe », jamais « verifie »", async () => {
    const review = await importTestimonial({
      productId,
      rating: 5,
      body: 'Reçu par WhatsApp, recopié à la main.',
      author: AUTHOR,
    })
    reviewIds.push(review.id)

    // C'est l'invariant central de l'écran : le badge « Achat vérifié » n'appartient qu'aux
    // avis réellement rattachés à une commande livrée.
    expect(review.source).toBe('imported')
    expect(review.orderId).toBeNull()
    // Saisi par la propriétaire elle-même : inutile de le faire passer par sa propre file
    // de modération.
    expect(review.status).toBe('published')
  })

  it("ignore un « source: verifie » glissé dans les données d'entrée", async () => {
    // Le schéma Zod ne déclare pas `source` : zod retire les clés inconnues, et l'action
    // fixe la valeur elle-même. Sans cela, un appelant pourrait fabriquer le badge.
    const review = await importTestimonial({
      productId,
      rating: 5,
      body: 'Tentative de forge du badge de vérification.',
      author: AUTHOR,
      source: 'verified',
      status: 'published',
      orderId: 'commande-forgee',
    })
    reviewIds.push(review.id)

    expect(review.source).toBe('imported')
    expect(review.orderId).toBeNull()
  })

  it('accepte un témoignage sans produit rattaché', async () => {
    const review = await importTestimonial({
      productId: null,
      rating: 4,
      body: 'Un mot laissé en boutique, sans produit précis.',
      author: AUTHOR,
    })
    reviewIds.push(review.id)
    expect(review.productId).toBeNull()
  })

  it('refuse une note hors de 1..5 et un texte trop court', async () => {
    await expect(
      importTestimonial({ productId, rating: 6, body: 'Correct assez', author: AUTHOR }),
    ).rejects.toThrow()
    await expect(
      importTestimonial({ productId, rating: 5, body: 'ok', author: AUTHOR }),
    ).rejects.toThrow()
    expect(await prisma.review.count({ where: { productId } })).toBe(0)
  })

  it("refuse un produit inexistant avec un message français, pas une violation de clé étrangère", async () => {
    await expect(
      importTestimonial({
        productId: 'produit-totalement-inexistant',
        rating: 5,
        body: 'Un témoignage sur un produit fantôme.',
        author: AUTHOR,
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it("journalise l'import dans le journal d'audit", async () => {
    const review = await importTestimonial({
      productId, rating: 5, body: 'Un témoignage à journaliser.', author: AUTHOR,
    })
    reviewIds.push(review.id)

    const auditTraces = await prisma.auditLog.findMany({
      where: { entity: 'Review', entityId: review.id },
    })
    expect(auditTraces).toHaveLength(1)
    expect(auditTraces[0]!.action).toBe('import_testimonial')
    expect(auditTraces[0]!.actor).toBe('admin@test.dev')
  })
})

describe('pinReview', () => {
  it("bascule la mise en avant sur la page d'accueil, dans les deux sens", async () => {
    const review = await createTestReview({ status: 'published' })
    expect(review.pinned).toBe(false)

    expect((await pinReview(review.id, true)).pinned).toBe(true)
    expect((await pinReview(review.id, false)).pinned).toBe(false)
  })

  it('journalise la valeur avant et après', async () => {
    const review = await createTestReview({ status: 'published' })
    await pinReview(review.id, true)

    const auditTraces = await prisma.auditLog.findMany({
      where: { entity: 'Review', entityId: review.id, action: 'pin_review' },
    })
    expect(auditTraces).toHaveLength(1)
    expect(auditTraces[0]!.before).toEqual({ pinned: false })
    expect(auditTraces[0]!.after).toEqual({ pinned: true })
  })
})

describe("pinReview — l'invariant est appliqué par l'action, pas par le composant", () => {
  // <ReviewActions> n'affiche le bouton d'épinglage que pour un avis publié, mais une Server
  // Action exportée reste un point d'entrée POST à part entière : le garde-fou du composant
  // client ne protège rien. Ces tests appellent donc l'action directement, exactement comme
  // le ferait un onglet resté sur un rendu périmé.
  it("refuse d'épingler un avis en attente, sans écrire ni épinglage ni trace", async () => {
    const review = await createTestReview({ status: 'pending' })

    await expect(pinReview(review.id, true)).rejects.toBeInstanceOf(ReviewNotPublishedError)

    const after = await prisma.review.findUniqueOrThrow({ where: { id: review.id } })
    expect(after.pinned).toBe(false)
    // Un refus n'est pas un événement : le journal ne doit raconter que ce qui a eu lieu.
    expect(
      await prisma.auditLog.count({ where: { entity: 'Review', entityId: review.id } }),
    ).toBe(0)
  })

  it("refuse d'épingler un avis rejeté entre-temps par un autre onglet", async () => {
    // Scénario réel : deux onglets ouverts sur la liste des avis publiés. L'onglet B rejette
    // l'avis ; l'onglet A, resté sur l'ancien rendu, clique « Épingler ».
    const review = await createTestReview({ status: 'published' })
    await moderateReview(review.id, 'rejected')

    await expect(pinReview(review.id, true)).rejects.toBeInstanceOf(ReviewNotPublishedError)
    expect(
      (await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).pinned,
    ).toBe(false)
  })

  it('laisse toujours dépunaiser, quel que soit le statut', async () => {
    // Dépunaiser ramène vers l'état cohérent. L'interdire enfermerait un avis épinglé hors
    // vitrine — précisément l'état que l'invariant existe pour empêcher.
    const review = await createTestReview({ status: 'rejected', pinned: true })
    expect((await pinReview(review.id, false)).pinned).toBe(false)
  })

  it("traduit le refus en français plutôt que de le laisser remonter en erreur 500", async () => {
    const review = await createTestReview({ status: 'pending' })

    const state = await pinReviewFromForm(
      review.id, true, initialReviewActionState, new FormData(),
    )

    expect(state.error).toMatch(/publié/)
    expect(state.error).not.toMatch(/Error|prisma|Invariant/i)
  })
})

describe("pinReview — valeur d'épinglage venue du client", () => {
  // Jumeau du garde posé sur le statut de `moderateReview` : `pinReview` est exportée du
  // même fichier `'use server'`, c'est donc le même genre de point d'entrée POST, et son
  // paramètre booléen arrive du client sans être typé à l'exécution.
  it("refuse une valeur non booléenne avec un message français, avant l'appel à Prisma", async () => {
    const review = await createTestReview({ status: 'published' })

    await expect(
      pinReview(review.id, 'oui' as never),
    ).rejects.toBeInstanceOf(InvalidPinError)
    await expect(
      pinReview(review.id, 'oui' as never),
    ).rejects.toThrow("Valeur d'épinglage invalide : oui")

    // Sans le garde, `'oui'` est truthy : l'invariant « publié » le laisse passer, et c'est
    // `prisma.review.update` qui échoue, en PrismaClientValidationError brute — une 500 sous
    // les yeux de l'administratrice.
    const after = await prisma.review.findUniqueOrThrow({ where: { id: review.id } })
    expect(after.pinned).toBe(false)
    // Un refus n'est pas un événement : le journal ne doit raconter que ce qui a eu lieu.
    expect(
      await prisma.auditLog.count({ where: { entity: 'Review', entityId: review.id } }),
    ).toBe(0)
  })

  it("refuse aussi une valeur absente, que le dépunaisage aurait acceptée en silence", async () => {
    // `undefined` est falsy : il franchit l'invariant « seul un avis publié s'épingle » par
    // la porte du dépunaisage, toujours ouverte. Seul un contrôle de TYPE l'arrête.
    const review = await createTestReview({ status: 'published', pinned: true })

    await expect(
      pinReview(review.id, undefined as never),
    ).rejects.toBeInstanceOf(InvalidPinError)

    expect(
      (await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).pinned,
    ).toBe(true)
  })

  it("traduit le refus en français dans l'adaptateur de formulaire", async () => {
    const review = await createTestReview({ status: 'published' })

    const state = await pinReviewFromForm(
      review.id, 'oui' as never, initialReviewActionState, new FormData(),
    )

    expect(state.error).toMatch(/épinglage/i)
    expect(state.error).not.toMatch(/prisma|invalid value|boolean|InvalidPin/i)
  })
})

describe('moderateReview — statut venu du client', () => {
  it("refuse un statut forgé avec un message français, avant l'énumération PostgreSQL", async () => {
    const review = await createTestReview({ status: 'pending' })

    await expect(
      moderateReview(review.id, 'supprime' as never),
    ).rejects.toBeInstanceOf(InvalidReviewStatusError)
    await expect(
      moderateReview(review.id, 'supprime' as never),
    ).rejects.toThrow("Statut d'avis inconnu : supprime")

    expect(
      (await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).status,
    ).toBe('pending')
  })

  it("refuse « en_attente » : modérer, c'est décider, pas remettre en file", async () => {
    const review = await createTestReview({ status: 'published' })

    await expect(
      moderateReview(review.id, 'pending' as never),
    ).rejects.toBeInstanceOf(InvalidReviewStatusError)
    expect(
      (await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).status,
    ).toBe('published')
  })

  it("traduit le refus en français dans l'adaptateur de formulaire", async () => {
    const review = await createTestReview({ status: 'pending' })

    const state = await moderateReviewFromForm(
      review.id, 'supprime' as never, initialReviewActionState, new FormData(),
    )

    expect(state.error).toMatch(/modération/i)
    expect(state.error).not.toMatch(/prisma|invalid value|enum/i)
  })
})

describe('moderateReview', () => {
  it('publie un avis en attente', async () => {
    const review = await createTestReview({ status: 'pending' })
    expect((await moderateReview(review.id, 'published')).status).toBe('published')
  })

  it("dépingle un avis qu'on rejette, pour ne pas laisser un avis épinglé hors vitrine", async () => {
    const review = await createTestReview({ status: 'published', pinned: true })
    const after = await moderateReview(review.id, 'rejected')
    expect(after.status).toBe('rejected')
    expect(after.pinned).toBe(false)
  })

  it("ne change pas la source d'un avis vérifié qu'on modère", async () => {
    const review = await createTestReview({ status: 'pending', source: 'verified' })
    expect((await moderateReview(review.id, 'published')).source).toBe('verified')
  })
})

describe("pinReview — une bascule sans effet n'est pas un événement", () => {
  // Un pas AU-DELÀ des deux garde-fous de <ReviewActions> traités ci-dessous, et pour la même
  // raison : le bouton d'épinglage est lié à `!avis.epingle`, donc deux onglets affichant
  // tous deux un avis non épinglé envoient tous deux `true`. Le second n'épingle rien — mais
  // sans ce garde il écrivait quand même une trace « epingle: true → true ».
  it("ne réécrit ni ne journalise un épinglage déjà en place", async () => {
    const review = await createTestReview({ status: 'published', pinned: true })

    expect((await pinReview(review.id, true)).pinned).toBe(true)

    expect(
      await prisma.auditLog.count({ where: { entity: 'Review', entityId: review.id } }),
    ).toBe(0)
  })

  it('ne journalise pas non plus un dépunaisage sur un avis qui ne l’est pas', async () => {
    const review = await createTestReview({ status: 'rejected', pinned: false })

    expect((await pinReview(review.id, false)).pinned).toBe(false)

    expect(
      await prisma.auditLog.count({ where: { entity: 'Review', entityId: review.id } }),
    ).toBe(0)
  })

  it("refuse toujours un avis non publié, même déjà épinglé : cet état-là est incohérent", async () => {
    // Verrouille l'ORDRE des deux contrôles. Si l'idempotence passait avant l'invariant, un
    // avis épinglé hors vitrine — précisément l'état que l'invariant existe pour empêcher —
    // se verrait confirmer son épinglage en silence.
    const review = await createTestReview({ status: 'pending', pinned: true })

    await expect(pinReview(review.id, true)).rejects.toBeInstanceOf(ReviewNotPublishedError)
  })
})

describe("moderateReview — une décision sans effet n'est pas un événement", () => {
  // <ReviewActions> n'affiche pas « Publier » sur un avis déjà publié, ni « Rejeter » sur un
  // avis déjà rejeté. Ces deux garde-fous vivaient uniquement dans le composant client :
  // un onglet resté sur un rendu périmé les contournait, et le journal d'audit enregistrait
  // alors un changement qui n'avait pas eu lieu (avant == après).
  it("ne réécrit ni ne journalise la publication d'un avis déjà publié", async () => {
    const review = await createTestReview({ status: 'published' })

    const after = await moderateReview(review.id, 'published')

    expect(after.status).toBe('published')
    expect(
      await prisma.auditLog.count({ where: { entity: 'Review', entityId: review.id } }),
    ).toBe(0)
  })

  it("ne réécrit ni ne journalise le rejet d'un avis déjà rejeté", async () => {
    const review = await createTestReview({ status: 'rejected' })

    const after = await moderateReview(review.id, 'rejected')

    expect(after.status).toBe('rejected')
    expect(
      await prisma.auditLog.count({ where: { entity: 'Review', entityId: review.id } }),
    ).toBe(0)
  })

  it("dépingle malgré tout un avis rejeté resté épinglé : cet état-là n'est pas le bon", async () => {
    // Verrouille la forme du garde : comparer le seul statut suffirait à faire passer les
    // deux tests précédents, mais laisserait un avis rejeté épinglé — précisément l'état
    // incohérent que le dépunaisage au rejet existe pour empêcher.
    const review = await createTestReview({ status: 'rejected', pinned: true })

    const after = await moderateReview(review.id, 'rejected')

    expect(after.pinned).toBe(false)
    // Là, un changement a bien eu lieu : il se journalise.
    expect(
      await prisma.auditLog.count({
        where: { entity: 'Review', entityId: review.id, action: 'moderate_review' },
      }),
    ).toBe(1)
  })
})

describe("actions d'avis — identifiant venu du client", () => {
  // Même parti pris que côté commandes (tests/admin/order-actions.test.ts, « laisse
  // remonter une panne technique ») et que `uploadMedia` côté produits : un identifiant
  // absent de l'interface est forgé, donc un DÉFAUT — pas une situation normale que la
  // propriétaire devrait lire sous le bouton. On ne le valide pas à part : `findUniqueOrThrow`
  // lève P2025, et les adaptateurs de formulaire laissent cette erreur remonter au lieu de
  // la déguiser en message métier.
  it("laisse remonter un identifiant forgé en erreur Prisma, sans le déguiser en message métier", async () => {
    const pinError = await pinReviewFromForm(
      'avis-totalement-inexistant', true, initialReviewActionState, new FormData(),
    ).then(() => null, (e: unknown) => e)

    expect(pinError).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((pinError as Prisma.PrismaClientKnownRequestError).code).toBe('P2025')
    // Surtout pas une erreur métier : c'est ce qui protège aussi la redirection de
    // requireAdmin(), qui s'implémente par un throw et ne doit jamais être avalée.
    expect(pinError).not.toBeInstanceOf(ReviewError)

    const moderationError = await moderateReviewFromForm(
      'avis-totalement-inexistant', 'published', initialReviewActionState, new FormData(),
    ).then(() => null, (e: unknown) => e)

    expect(moderationError).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((moderationError as Prisma.PrismaClientKnownRequestError).code).toBe('P2025')
    expect(moderationError).not.toBeInstanceOf(ReviewError)
  })

  it("ne journalise rien pour un identifiant forgé", async () => {
    await expect(
      moderateReview('avis-totalement-inexistant', 'published'),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)

    expect(
      await prisma.auditLog.count({
        where: { entity: 'Review', entityId: 'avis-totalement-inexistant' },
      }),
    ).toBe(0)
  })
})
