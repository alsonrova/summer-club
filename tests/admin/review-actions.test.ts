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

// Mêmes doublures que tests/admin/produits-actions.test.ts : requireAdmin() lit une session
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
  // Rattrape aussi les avis créés par importTestimonial, dont l'identifiant n'est pas
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

describe('importTestimonial', () => {
  it("crée l'avis en source « importe », jamais « verifie »", async () => {
    const avis = await importTestimonial({
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
    const avis = await importTestimonial({
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
    const avis = await importTestimonial({
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
      importTestimonial({ productId, note: 6, texte: 'Correct assez', auteur: AUTEUR }),
    ).rejects.toThrow()
    await expect(
      importTestimonial({ productId, note: 5, texte: 'ok', auteur: AUTEUR }),
    ).rejects.toThrow()
    expect(await prisma.review.count({ where: { productId } })).toBe(0)
  })

  it("refuse un produit inexistant avec un message français, pas une violation de clé étrangère", async () => {
    await expect(
      importTestimonial({
        productId: 'produit-totalement-inexistant',
        note: 5,
        texte: 'Un témoignage sur un produit fantôme.',
        auteur: AUTEUR,
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it("journalise l'import dans le journal d'audit", async () => {
    const avis = await importTestimonial({
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

describe('pinReview', () => {
  it("bascule la mise en avant sur la page d'accueil, dans les deux sens", async () => {
    const avis = await creerAvisDeTest({ statut: 'publie' })
    expect(avis.epingle).toBe(false)

    expect((await pinReview(avis.id, true)).epingle).toBe(true)
    expect((await pinReview(avis.id, false)).epingle).toBe(false)
  })

  it('journalise la valeur avant et après', async () => {
    const avis = await creerAvisDeTest({ statut: 'publie' })
    await pinReview(avis.id, true)

    const traces = await prisma.auditLog.findMany({
      where: { entite: 'Review', entiteId: avis.id, action: 'epingler_avis' },
    })
    expect(traces).toHaveLength(1)
    expect(traces[0]!.avant).toEqual({ epingle: false })
    expect(traces[0]!.apres).toEqual({ epingle: true })
  })
})

describe("pinReview — l'invariant est appliqué par l'action, pas par le composant", () => {
  // <ReviewActions> n'affiche le bouton d'épinglage que pour un avis publié, mais une Server
  // Action exportée reste un point d'entrée POST à part entière : le garde-fou du composant
  // client ne protège rien. Ces tests appellent donc l'action directement, exactement comme
  // le ferait un onglet resté sur un rendu périmé.
  it("refuse d'épingler un avis en attente, sans écrire ni épinglage ni trace", async () => {
    const avis = await creerAvisDeTest({ statut: 'en_attente' })

    await expect(pinReview(avis.id, true)).rejects.toBeInstanceOf(ReviewNotPublishedError)

    const apres = await prisma.review.findUniqueOrThrow({ where: { id: avis.id } })
    expect(apres.epingle).toBe(false)
    // Un refus n'est pas un événement : le journal ne doit raconter que ce qui a eu lieu.
    expect(
      await prisma.auditLog.count({ where: { entite: 'Review', entiteId: avis.id } }),
    ).toBe(0)
  })

  it("refuse d'épingler un avis rejeté entre-temps par un autre onglet", async () => {
    // Scénario réel : deux onglets ouverts sur la liste des avis publiés. L'onglet B rejette
    // l'avis ; l'onglet A, resté sur l'ancien rendu, clique « Épingler ».
    const avis = await creerAvisDeTest({ statut: 'publie' })
    await moderateReview(avis.id, 'rejete')

    await expect(pinReview(avis.id, true)).rejects.toBeInstanceOf(ReviewNotPublishedError)
    expect(
      (await prisma.review.findUniqueOrThrow({ where: { id: avis.id } })).epingle,
    ).toBe(false)
  })

  it('laisse toujours dépunaiser, quel que soit le statut', async () => {
    // Dépunaiser ramène vers l'état cohérent. L'interdire enfermerait un avis épinglé hors
    // vitrine — précisément l'état que l'invariant existe pour empêcher.
    const avis = await creerAvisDeTest({ statut: 'rejete', epingle: true })
    expect((await pinReview(avis.id, false)).epingle).toBe(false)
  })

  it("traduit le refus en français plutôt que de le laisser remonter en erreur 500", async () => {
    const avis = await creerAvisDeTest({ statut: 'en_attente' })

    const etat = await pinReviewFromForm(
      avis.id, true, initialReviewActionState, new FormData(),
    )

    expect(etat.error).toMatch(/publié/)
    expect(etat.error).not.toMatch(/Error|prisma|Invariant/i)
  })
})

describe("pinReview — valeur d'épinglage venue du client", () => {
  // Jumeau du garde posé sur le statut de `moderateReview` : `pinReview` est exportée du
  // même fichier `'use server'`, c'est donc le même genre de point d'entrée POST, et son
  // paramètre booléen arrive du client sans être typé à l'exécution.
  it("refuse une valeur non booléenne avec un message français, avant l'appel à Prisma", async () => {
    const avis = await creerAvisDeTest({ statut: 'publie' })

    await expect(
      pinReview(avis.id, 'oui' as never),
    ).rejects.toBeInstanceOf(InvalidPinError)
    await expect(
      pinReview(avis.id, 'oui' as never),
    ).rejects.toThrow("Valeur d'épinglage invalide : oui")

    // Sans le garde, `'oui'` est truthy : l'invariant « publié » le laisse passer, et c'est
    // `prisma.review.update` qui échoue, en PrismaClientValidationError brute — une 500 sous
    // les yeux de l'administratrice.
    const apres = await prisma.review.findUniqueOrThrow({ where: { id: avis.id } })
    expect(apres.epingle).toBe(false)
    // Un refus n'est pas un événement : le journal ne doit raconter que ce qui a eu lieu.
    expect(
      await prisma.auditLog.count({ where: { entite: 'Review', entiteId: avis.id } }),
    ).toBe(0)
  })

  it("refuse aussi une valeur absente, que le dépunaisage aurait acceptée en silence", async () => {
    // `undefined` est falsy : il franchit l'invariant « seul un avis publié s'épingle » par
    // la porte du dépunaisage, toujours ouverte. Seul un contrôle de TYPE l'arrête.
    const avis = await creerAvisDeTest({ statut: 'publie', epingle: true })

    await expect(
      pinReview(avis.id, undefined as never),
    ).rejects.toBeInstanceOf(InvalidPinError)

    expect(
      (await prisma.review.findUniqueOrThrow({ where: { id: avis.id } })).epingle,
    ).toBe(true)
  })

  it("traduit le refus en français dans l'adaptateur de formulaire", async () => {
    const avis = await creerAvisDeTest({ statut: 'publie' })

    const etat = await pinReviewFromForm(
      avis.id, 'oui' as never, initialReviewActionState, new FormData(),
    )

    expect(etat.error).toMatch(/épinglage/i)
    expect(etat.error).not.toMatch(/prisma|invalid value|boolean|InvalidPin/i)
  })
})

describe('moderateReview — statut venu du client', () => {
  it("refuse un statut forgé avec un message français, avant l'énumération PostgreSQL", async () => {
    const avis = await creerAvisDeTest({ statut: 'en_attente' })

    await expect(
      moderateReview(avis.id, 'supprime' as never),
    ).rejects.toBeInstanceOf(InvalidReviewStatusError)
    await expect(
      moderateReview(avis.id, 'supprime' as never),
    ).rejects.toThrow("Statut d'avis inconnu : supprime")

    expect(
      (await prisma.review.findUniqueOrThrow({ where: { id: avis.id } })).statut,
    ).toBe('en_attente')
  })

  it("refuse « en_attente » : modérer, c'est décider, pas remettre en file", async () => {
    const avis = await creerAvisDeTest({ statut: 'publie' })

    await expect(
      moderateReview(avis.id, 'en_attente' as never),
    ).rejects.toBeInstanceOf(InvalidReviewStatusError)
    expect(
      (await prisma.review.findUniqueOrThrow({ where: { id: avis.id } })).statut,
    ).toBe('publie')
  })

  it("traduit le refus en français dans l'adaptateur de formulaire", async () => {
    const avis = await creerAvisDeTest({ statut: 'en_attente' })

    const etat = await moderateReviewFromForm(
      avis.id, 'supprime' as never, initialReviewActionState, new FormData(),
    )

    expect(etat.error).toMatch(/modération/i)
    expect(etat.error).not.toMatch(/prisma|invalid value|enum/i)
  })
})

describe('moderateReview', () => {
  it('publie un avis en attente', async () => {
    const avis = await creerAvisDeTest({ statut: 'en_attente' })
    expect((await moderateReview(avis.id, 'publie')).statut).toBe('publie')
  })

  it("dépingle un avis qu'on rejette, pour ne pas laisser un avis épinglé hors vitrine", async () => {
    const avis = await creerAvisDeTest({ statut: 'publie', epingle: true })
    const apres = await moderateReview(avis.id, 'rejete')
    expect(apres.statut).toBe('rejete')
    expect(apres.epingle).toBe(false)
  })

  it("ne change pas la source d'un avis vérifié qu'on modère", async () => {
    const avis = await creerAvisDeTest({ statut: 'en_attente', source: 'verifie' })
    expect((await moderateReview(avis.id, 'publie')).source).toBe('verifie')
  })
})

describe("pinReview — une bascule sans effet n'est pas un événement", () => {
  // Un pas AU-DELÀ des deux garde-fous de <ReviewActions> traités ci-dessous, et pour la même
  // raison : le bouton d'épinglage est lié à `!avis.epingle`, donc deux onglets affichant
  // tous deux un avis non épinglé envoient tous deux `true`. Le second n'épingle rien — mais
  // sans ce garde il écrivait quand même une trace « epingle: true → true ».
  it("ne réécrit ni ne journalise un épinglage déjà en place", async () => {
    const avis = await creerAvisDeTest({ statut: 'publie', epingle: true })

    expect((await pinReview(avis.id, true)).epingle).toBe(true)

    expect(
      await prisma.auditLog.count({ where: { entite: 'Review', entiteId: avis.id } }),
    ).toBe(0)
  })

  it('ne journalise pas non plus un dépunaisage sur un avis qui ne l’est pas', async () => {
    const avis = await creerAvisDeTest({ statut: 'rejete', epingle: false })

    expect((await pinReview(avis.id, false)).epingle).toBe(false)

    expect(
      await prisma.auditLog.count({ where: { entite: 'Review', entiteId: avis.id } }),
    ).toBe(0)
  })

  it("refuse toujours un avis non publié, même déjà épinglé : cet état-là est incohérent", async () => {
    // Verrouille l'ORDRE des deux contrôles. Si l'idempotence passait avant l'invariant, un
    // avis épinglé hors vitrine — précisément l'état que l'invariant existe pour empêcher —
    // se verrait confirmer son épinglage en silence.
    const avis = await creerAvisDeTest({ statut: 'en_attente', epingle: true })

    await expect(pinReview(avis.id, true)).rejects.toBeInstanceOf(ReviewNotPublishedError)
  })
})

describe("moderateReview — une décision sans effet n'est pas un événement", () => {
  // <ReviewActions> n'affiche pas « Publier » sur un avis déjà publié, ni « Rejeter » sur un
  // avis déjà rejeté. Ces deux garde-fous vivaient uniquement dans le composant client :
  // un onglet resté sur un rendu périmé les contournait, et le journal d'audit enregistrait
  // alors un changement qui n'avait pas eu lieu (avant == après).
  it("ne réécrit ni ne journalise la publication d'un avis déjà publié", async () => {
    const avis = await creerAvisDeTest({ statut: 'publie' })

    const apres = await moderateReview(avis.id, 'publie')

    expect(apres.statut).toBe('publie')
    expect(
      await prisma.auditLog.count({ where: { entite: 'Review', entiteId: avis.id } }),
    ).toBe(0)
  })

  it("ne réécrit ni ne journalise le rejet d'un avis déjà rejeté", async () => {
    const avis = await creerAvisDeTest({ statut: 'rejete' })

    const apres = await moderateReview(avis.id, 'rejete')

    expect(apres.statut).toBe('rejete')
    expect(
      await prisma.auditLog.count({ where: { entite: 'Review', entiteId: avis.id } }),
    ).toBe(0)
  })

  it("dépingle malgré tout un avis rejeté resté épinglé : cet état-là n'est pas le bon", async () => {
    // Verrouille la forme du garde : comparer le seul statut suffirait à faire passer les
    // deux tests précédents, mais laisserait un avis rejeté épinglé — précisément l'état
    // incohérent que le dépunaisage au rejet existe pour empêcher.
    const avis = await creerAvisDeTest({ statut: 'rejete', epingle: true })

    const apres = await moderateReview(avis.id, 'rejete')

    expect(apres.epingle).toBe(false)
    // Là, un changement a bien eu lieu : il se journalise.
    expect(
      await prisma.auditLog.count({
        where: { entite: 'Review', entiteId: avis.id, action: 'moderer_avis' },
      }),
    ).toBe(1)
  })
})

describe("actions d'avis — identifiant venu du client", () => {
  // Même parti pris que côté commandes (tests/admin/commandes-actions.test.ts, « laisse
  // remonter une panne technique ») et que `televerserMedia` côté produits : un identifiant
  // absent de l'interface est forgé, donc un DÉFAUT — pas une situation normale que la
  // propriétaire devrait lire sous le bouton. On ne le valide pas à part : `findUniqueOrThrow`
  // lève P2025, et les adaptateurs de formulaire laissent cette erreur remonter au lieu de
  // la déguiser en message métier.
  it("laisse remonter un identifiant forgé en erreur Prisma, sans le déguiser en message métier", async () => {
    const erreurEpinglage = await pinReviewFromForm(
      'avis-totalement-inexistant', true, initialReviewActionState, new FormData(),
    ).then(() => null, (e: unknown) => e)

    expect(erreurEpinglage).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((erreurEpinglage as Prisma.PrismaClientKnownRequestError).code).toBe('P2025')
    // Surtout pas une erreur métier : c'est ce qui protège aussi la redirection de
    // requireAdmin(), qui s'implémente par un throw et ne doit jamais être avalée.
    expect(erreurEpinglage).not.toBeInstanceOf(ReviewError)

    const erreurModeration = await moderateReviewFromForm(
      'avis-totalement-inexistant', 'publie', initialReviewActionState, new FormData(),
    ).then(() => null, (e: unknown) => e)

    expect(erreurModeration).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((erreurModeration as Prisma.PrismaClientKnownRequestError).code).toBe('P2025')
    expect(erreurModeration).not.toBeInstanceOf(ReviewError)
  })

  it("ne journalise rien pour un identifiant forgé", async () => {
    await expect(
      moderateReview('avis-totalement-inexistant', 'publie'),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)

    expect(
      await prisma.auditLog.count({
        where: { entite: 'Review', entiteId: 'avis-totalement-inexistant' },
      }),
    ).toBe(0)
  })
})
