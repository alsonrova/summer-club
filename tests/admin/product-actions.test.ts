import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { prisma } from '@/server/db'
import { UnreadableImageError } from '@/server/media'
import {
  createProduct,
  updateProduct,
  createVariant,
  adjustStock,
  uploadMedia,
  reorderMedia,
  updateMediaAlt,
  setPrimaryPhoto,
  deleteMedia,
} from '@/app/admin/produits/actions'

// adjustStock/uploadMedia/reorderMedia (et désormais createProduct/updateProduct/
// createVariant/updateMediaAlt/setPrimaryPhoto/deleteMedia) passent par
// requireAdmin() (session, next/headers) et revalidatePath() (cache App Router) : tous deux
// exigent un contexte de requête Next.js réel, absent sous Vitest. Même doublure que
// tests/admin/champs-systeme.test.ts pour requireAdmin ; revalidatePath n'a pas besoin de
// faire quoi que ce soit ici, seulement de ne pas lever.
vi.mock('@/server/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { email: 'admin@test.dev' } }),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
// redirect() a un type de retour `never` : en production, Next.js l'implémente en levant
// une erreur spéciale (digest `NEXT_REDIRECT`) qui interrompt l'exécution. On reproduit ce
// comportement (lever) plutôt que de le neutraliser (une doublure qui ne fait rien
// laisserait `createProduct` se poursuivre après l'appel, un chemin que le vrai runtime
// n'emprunte jamais) — le test du chemin nominal de createProduct s'attend donc lui-même à
// ce que l'appel lève, une fois l'écriture en base et l'audit déjà faits.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))
// Interrupteur permettant à un test d'armer un échec d'écriture disque (voir le test de la
// panne technique dans le describe uploadMedia). `vi.hoisted` est nécessaire : les
// fabriques passées à vi.mock sont hissées au-dessus des déclarations du module.
const writeControl = vi.hoisted(() => ({
  error: null as (Error & { code?: string }) | null,
}))
// Doublure PARTIELLE : tout node:fs/promises reste réel, seul writeFile peut être armé pour
// échouer. On mocke le système de fichiers plutôt que processImage afin que le vrai pipeline
// s'exécute — sharp encode réellement l'image, seule l'écriture casse. C'est exactement la
// situation que uploadMedia doit savoir distinguer d'un fichier illisible.
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...real,
    writeFile: async (...args: Parameters<typeof real.writeFile>) => {
      if (writeControl.error) throw writeControl.error
      // writeFile est surchargée : on relaie les arguments tels quels.
      return (real.writeFile as (...a: unknown[]) => Promise<void>)(...args)
    },
  }
})

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

  const category = await prisma.category.create({
    data: { slug: `${PREFIXE}categorie`, name: 'Catégorie de test admin' },
  })
  categoryId = category.id

  const product = await prisma.product.create({
    data: {
      slug: `${PREFIXE}produit`,
      name: 'Produit de test admin',
      description: 'Produit créé uniquement pour les tests des actions admin.',
      categoryId,
      basePrice: 10000,
    },
  })
  productId = product.id

  const variant = await prisma.variant.create({
    data: { productId, label: 'Unique', sku: `${PREFIXE}sku`, stock: 5 },
  })
  variantId = variant.id
})

afterAll(async () => {
  await prisma.variant.deleteMany({ where: { sku: { startsWith: PREFIXE } } })
  await prisma.media.deleteMany({ where: { productId } })
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIXE } } })
  await prisma.category.deleteMany({ where: { slug: `${PREFIXE}categorie` } })
  // Chaque test qui écrit un journal d'audit sur une entité qu'il crée lui-même supprime
  // déjà cette ligne (voir chaque `it` ci-dessous) ; cette dernière passe ne couvre que
  // l'entité fixe partagée par tout le fichier (productId/variantId), pour ne laisser
  // aucune ligne orpheline en base après coup (voir Correctif 8, « résidus d'audit »).
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [productId, variantId] } } })
  await prisma.$disconnect()
})

beforeEach(async () => {
  await prisma.variant.update({ where: { id: variantId }, data: { stock: 5 } })

  // Nettoyage du journal d'audit restreint aux entités créées par CE fichier : sa
  // variante fixe, son produit fixe, et tout ce qui pend actuellement à ce produit.
  // Le filtre précédent (`entite: { in: ['Variant', 'Media'] }`, sans `entiteId`) ne
  // portait que sur le TYPE d'entité : il vidait le journal d'audit de la base entière
  // pointée par DATABASE_URL — y compris les lignes qu'un autre fichier de test, exécuté
  // en parallèle, venait d'écrire et s'apprêtait à relire.
  const [variantRows, mediaRows] = await Promise.all([
    prisma.variant.findMany({ where: { productId }, select: { id: true } }),
    prisma.media.findMany({ where: { productId }, select: { id: true } }),
  ])
  await prisma.auditLog.deleteMany({
    where: {
      entityId: {
        in: [productId, variantId, ...variantRows.map((v) => v.id), ...mediaRows.map((m) => m.id)],
      },
    },
  })
})

// Restauration systématique, et non en dernière instruction d'un test : `vitest.config.ts`
// n'active ni `restoreMocks` ni `unstubEnvs`, et un `journal.mockRestore()` placé en fin de
// test ne s'exécute pas si une assertion échoue avant lui — console.error resterait alors
// muselée pour tous les fichiers suivants du même worker. Idem pour l'échec d'écriture armé
// ci-dessus : il ne doit jamais fuir vers le test suivant.
afterEach(() => {
  writeControl.error = null
  // N'affecte que les espions créés par vi.spyOn (vérifié dans @vitest/spy : seuls eux
  // enregistrent un `restore`) — les doublures vi.fn() de vi.mock ci-dessus sont intactes.
  vi.restoreAllMocks()
})

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(entries)) fd.set(key, value)
  return fd
}

describe('adjustStock', () => {
  it('refuse un stock non entier', async () => {
    const state = await adjustStock(variantId, { error: null }, formData({ stock: '4.5' }))
    expect(state.error).toMatch(/entier/)
    const after = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(after.stock).toBe(5)
  })

  it('refuse un stock négatif', async () => {
    const state = await adjustStock(variantId, { error: null }, formData({ stock: '-1' }))
    expect(state.error).toMatch(/positif|négatif/)
    const after = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(after.stock).toBe(5)
  })

  it('accepte un stock entier positif ou nul et écrit un journal avant/après', async () => {
    const state = await adjustStock(variantId, { error: null }, formData({ stock: '12' }))
    expect(state.error).toBeNull()

    const after = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(after.stock).toBe(12)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'Variant', entityId: variantId },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.before).toEqual({ stock: 5 })
    expect(audit.after).toEqual({ stock: 12 })
  })

  it('accepte un stock ramené à zéro', async () => {
    const state = await adjustStock(variantId, { error: null }, formData({ stock: '0' }))
    expect(state.error).toBeNull()
    const after = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })
    expect(after.stock).toBe(0)
  })
})

describe('uploadMedia', () => {
  it('refuse un type de fichier non autorisé sans créer de média', async () => {
    const before = await prisma.media.count({ where: { productId } })

    const file = new File(['contenu texte'], 'notice.pdf', { type: 'application/pdf' })
    const fd = new FormData()
    fd.set('file', file)

    const state = await uploadMedia(productId, { error: null }, fd)
    expect(state.error).toMatch(/Format non accepté/)

    const after = await prisma.media.count({ where: { productId } })
    expect(after).toBe(before)
  })

  it("refuse l'absence de fichier", async () => {
    const state = await uploadMedia(productId, { error: null }, new FormData())
    expect(state.error).toMatch(/Aucun fichier/)
  })

  it("retourne le message « image illisible » pour un fichier au type MIME accepté dont le contenu n'est pas une image", async () => {
    // Le test voisin (application/pdf) est arrêté par validateMediaFile et n'atteint
    // jamais processImage : c'est un test de la garde d'entrée, pas du message d'erreur.
    // Ici le type MIME est image/jpeg — donc accepté — mais le contenu n'en est pas une :
    // la validation laisse passer, sharp échoue, et c'est le seul chemin qui atteint
    // réellement le message français rendu à la propriétaire.
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    const before = await prisma.media.count({ where: { productId } })

    const file = new File([Buffer.from("ceci est du texte, pas une image")], 'faux.jpg', {
      type: 'image/jpeg',
    })
    const fd = new FormData()
    fd.set('file', file)

    const state = await uploadMedia(productId, { error: null }, fd)
    // Retourné, pas levé : l'action ne doit pas planter sur une entrée que l'utilisateur
    // peut corriger lui-même.
    expect(state.error).toMatch(/n'a pas pu être lue/)

    const after = await prisma.media.count({ where: { productId } })
    expect(after).toBe(before)

    // L'erreur réelle (celle de sharp) reste journalisée côté serveur : sans elle, un
    // disque plein et un fichier corrompu se ressembleraient dans les journaux.
    expect(journal).toHaveBeenCalledTimes(1)
    const appel = journal.mock.calls[0]
    expect(String(appel?.[0])).toMatch(/uploadMedia/)
    const context = appel?.[1] as { productId: string; error: unknown }
    expect(context.productId).toBe(productId)
    expect(context.error).toBeInstanceOf(UnreadableImageError)
    expect((context.error as UnreadableImageError).cause).toBeInstanceOf(Error)
  })

  it("retourne le message de panne technique, et non « image illisible », quand c'est l'écriture disque qui échoue", async () => {
    // Test jumeau du précédent, et le seul à couvrir la branche FAUSSE du discriminant
    // `error instanceof UnreadableImageError`. Sans lui, supprimer ce discriminant pour
    // répondre « image illisible » à n'importe quel échec — c'est-à-dire réintroduire
    // exactement la confusion que le correctif a fermée — laisserait la suite entièrement
    // verte. Ici l'image est une VRAIE image : sharp l'encode sans broncher, c'est
    // l'écriture sur disque qui échoue, avec une erreur nue portant un code système.
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    const before = await prisma.media.count({ where: { productId } })

    const image = await sharp({
      create: { width: 400, height: 500, channels: 3, background: '#EDE5DA' },
    })
      .jpeg()
      .toBuffer()
    const fd = new FormData()
    fd.set('file', new File([image], 'photo.jpg', { type: 'image/jpeg' }))

    const panne = Object.assign(new Error('ENOSPC: no space left on device, write'), {
      code: 'ENOSPC',
    })
    // Désarmé par l'afterEach de ce fichier, y compris si une assertion échoue plus bas.
    writeControl.error = panne

    const state = await uploadMedia(productId, { error: null }, fd)

    expect(state.error).toMatch(/raison technique/)
    expect(state.error).not.toMatch(/n'a pas pu être lue/)

    // Rien n'est créé en base, et le journal serveur porte l'erreur réelle — celle qui
    // permet de diagnostiquer un disque plein — et non une UnreadableImageError.
    expect(await prisma.media.count({ where: { productId } })).toBe(before)
    expect(journal).toHaveBeenCalledTimes(1)
    const context = journal.mock.calls[0]?.[1] as { productId: string; error: unknown }
    expect(context.productId).toBe(productId)
    expect(context.error).toBe(panne)
    expect(context.error).not.toBeInstanceOf(UnreadableImageError)
  })
})

describe('reorderMedia', () => {
  it('refuse une position négative', async () => {
    const state = await reorderMedia('media-inexistant', { error: null }, formData({ position: '-1' }))
    expect(state.error).toMatch(/entier|positif/)
  })

  it('refuse une position non entière', async () => {
    const state = await reorderMedia('media-inexistant', { error: null }, formData({ position: '1.5' }))
    expect(state.error).toMatch(/entier/)
  })

  it('chemin nominal : met à jour la position et écrit un journal avant/après', async () => {
    const media = await prisma.media.create({
      data: { productId, path: '/uploads/reordonner-test', alt: '', position: 0, isPrimary: false },
    })

    const state = await reorderMedia(media.id, { error: null }, formData({ position: '4' }))
    expect(state.error).toBeNull()

    const after = await prisma.media.findUniqueOrThrow({ where: { id: media.id } })
    expect(after.position).toBe(4)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'Media', entityId: media.id, action: 'reorder_media' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.before).toEqual({ position: 0 })
    expect(audit.after).toEqual({ position: 4 })

    await prisma.media.delete({ where: { id: media.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: media.id } })
  })
})

describe('createProduct (chemin nominal)', () => {
  it('crée le produit en base et écrit un journal d’audit', async () => {
    const slug = `${PREFIXE}bracelet-nominal`
    const data = formData({
      name: 'Bracelet Test Nominal',
      slug,
      description: 'Bracelet créé uniquement pour vérifier le chemin nominal de createProduct.',
      categoryId,
      basePrice: '15000',
      costPrice: '5000',
      active: 'on',
      displayOrder: '3',
    })

    // redirect() (mocké ci-dessus) lève après l'écriture réussie : c'est le comportement
    // réel reproduit, pas un défaut du test.
    await expect(
      createProduct({ success: false, errors: {}, initialValues: {} }, data),
    ).rejects.toThrow(/NEXT_REDIRECT/)

    const product = await prisma.product.findUniqueOrThrow({ where: { slug } })
    expect(product.name).toBe('Bracelet Test Nominal')
    expect(product.basePrice).toBe(15000)
    expect(product.costPrice).toBe(5000)
    expect(product.displayOrder).toBe(3)
    expect(product.active).toBe(true)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'products', entityId: product.id, action: 'create' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.after).toMatchObject({ name: 'Bracelet Test Nominal', basePrice: 15000, displayOrder: 3 })

    await prisma.product.delete({ where: { id: product.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: product.id } })
  })

  it('refuse un slug déjà utilisé par un autre produit avec un message dédié', async () => {
    const slug = `${PREFIXE}slug-en-double`
    const existing = await prisma.product.create({
      data: {
        slug,
        name: 'Produit déjà en place',
        description: 'Produit créé uniquement pour provoquer une collision de slug.',
        categoryId,
        basePrice: 10000,
      },
    })

    const data = formData({
      name: 'Autre produit',
      slug,
      description: 'Second produit qui tente de reprendre le même slug que le premier.',
      categoryId,
      basePrice: '12000',
      costPrice: '0',
      active: 'on',
      displayOrder: '0',
    })

    const state = await createProduct({ success: false, errors: {}, initialValues: {} }, data)
    expect(state.success).toBe(false)
    expect(state.errors.slug?.[0]).toMatch(/slug.*déjà utilisé/)

    const count = await prisma.product.count({ where: { slug, name: 'Autre produit' } })
    expect(count).toBe(0)

    await prisma.product.delete({ where: { id: existing.id } })
  })
})

// Couvre le .trim() de productSchema (src/admin/resources/products.ts) : sans lui, un nom
// entouré ou fait uniquement d'espaces passait la validation et produisait, une fois copié
// tel quel dans le texte alternatif de la photo par défaut, un alt que updateMediaAlt
// refuse ensuite (vide ou fait uniquement d'espaces) — l'incohérence que le correctif ferme.
describe('createProduct — normalisation du nom (.trim())', () => {
  it('normalise un nom entouré d’espaces avant de l’écrire en base', async () => {
    const slug = `${PREFIXE}nom-entoure-espaces`
    const data = formData({
      name: '  Bracelet Espaces  ',
      slug,
      description: 'Bracelet créé uniquement pour vérifier le trim() du nom.',
      categoryId,
      basePrice: '10000',
      costPrice: '0',
      active: 'on',
      displayOrder: '0',
    })

    await expect(
      createProduct({ success: false, errors: {}, initialValues: {} }, data),
    ).rejects.toThrow(/NEXT_REDIRECT/)

    const product = await prisma.product.findUniqueOrThrow({ where: { slug } })
    expect(product.name).toBe('Bracelet Espaces')

    await prisma.product.delete({ where: { id: product.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: product.id } })
  })

  it('refuse un nom uniquement composé d’espaces', async () => {
    const slug = `${PREFIXE}nom-espaces-seuls`
    const data = formData({
      name: '   ',
      slug,
      description: 'Ce produit ne doit jamais être créé : nom fait uniquement d’espaces.',
      categoryId,
      basePrice: '10000',
      costPrice: '0',
      active: 'on',
      displayOrder: '0',
    })

    const state = await createProduct({ success: false, errors: {}, initialValues: {} }, data)
    expect(state.success).toBe(false)
    expect(state.errors.name?.[0]).toBe('Le nom est requis')

    const count = await prisma.product.count({ where: { slug } })
    expect(count).toBe(0)
  })
})

describe('updateProduct (chemin nominal)', () => {
  it('met à jour le produit et écrit un journal symétrique (mêmes clés avant/après)', async () => {
    const product = await prisma.product.create({
      data: {
        slug: `${PREFIXE}modif-produit`,
        name: 'Produit à modifier',
        description: 'Produit créé uniquement pour tester le chemin nominal de updateProduct.',
        categoryId,
        basePrice: 20000,
        displayOrder: 1,
      },
    })

    const data = formData({
      name: 'Produit modifié',
      slug: `${PREFIXE}modif-produit`,
      description: 'Produit créé uniquement pour tester updateProduct, désormais modifié.',
      categoryId,
      basePrice: '25000',
      costPrice: '9000',
      active: 'on',
      displayOrder: '2',
    })

    const state = await updateProduct(
      product.id,
      { success: false, errors: {}, initialValues: {} },
      data,
    )
    expect(state.success).toBe(true)

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
    expect(after.name).toBe('Produit modifié')
    expect(after.basePrice).toBe(25000)
    expect(after.displayOrder).toBe(2)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'products', entityId: product.id, action: 'update' },
      orderBy: { createdAt: 'desc' },
    })
    const before = audit.before as Record<string, unknown>
    const auditAfter = audit.after as Record<string, unknown>
    // Correctif 8 (revue de la tâche 11) : `before` restreint aux mêmes clés que `after`,
    // pour rester comparable champ à champ — sans quoi `before` porterait aussi des dates et
    // des colonnes absentes du formulaire.
    expect(Object.keys(before).sort()).toEqual(Object.keys(auditAfter).sort())
    expect(before['basePrice']).toBe(20000)
    expect(auditAfter['basePrice']).toBe(25000)

    await prisma.product.delete({ where: { id: product.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: product.id } })
  })

  it('refuse un slug déjà utilisé par un autre produit avec un message dédié', async () => {
    const autre = await prisma.product.create({
      data: {
        slug: `${PREFIXE}modif-collision-cible`,
        name: 'Produit cible',
        description: 'Produit dont le slug sera revendiqué par un autre.',
        categoryId,
        basePrice: 10000,
      },
    })
    const product = await prisma.product.create({
      data: {
        slug: `${PREFIXE}modif-collision-source`,
        name: 'Produit source',
        description: 'Produit dont on tente de changer le slug pour celui d’un autre.',
        categoryId,
        basePrice: 10000,
      },
    })

    const data = formData({
      name: 'Produit source',
      slug: `${PREFIXE}modif-collision-cible`,
      description: 'Produit dont on tente de changer le slug pour celui d’un autre.',
      categoryId,
      basePrice: '10000',
      costPrice: '0',
      active: 'on',
      displayOrder: '0',
    })

    const state = await updateProduct(
      product.id,
      { success: false, errors: {}, initialValues: {} },
      data,
    )
    expect(state.success).toBe(false)
    expect(state.errors.slug?.[0]).toMatch(/slug.*déjà utilisé/)

    await prisma.product.deleteMany({ where: { id: { in: [autre.id, product.id] } } })
  })
})

describe('createVariant', () => {
  it('crée la déclinaison en base et écrit un journal d’audit (chemin nominal)', async () => {
    const sku = `${PREFIXE}sku-L`
    const state = await createVariant(
      productId,
      { success: false, errors: {}, initialValues: {} },
      formData({ label: 'Taille L', sku, priceDelta: '1500', stock: '3' }),
    )
    expect(state.success).toBe(true)

    const variant = await prisma.variant.findFirstOrThrow({ where: { sku } })
    expect(variant.priceDelta).toBe(1500)
    expect(variant.stock).toBe(3)
    expect(variant.productId).toBe(productId)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'Variant', entityId: variant.id, action: 'create' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.after).toMatchObject({ label: 'Taille L', sku, priceDelta: 1500, stock: 3 })

    await prisma.variant.delete({ where: { id: variant.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: variant.id } })
  })

  it('accepte un écart de prix négatif tant que le prix de vente résultant reste positif', async () => {
    const sku = `${PREFIXE}sku-S`
    // productId a prixBase: 10000 (fixture ci-dessus) ; -500 donne un prix résultant de
    // 9500, toujours positif.
    const state = await createVariant(
      productId,
      { success: false, errors: {}, initialValues: {} },
      formData({ label: 'Taille S', sku, priceDelta: '-500', stock: '1' }),
    )
    expect(state.success).toBe(true)

    const variant = await prisma.variant.findFirstOrThrow({ where: { sku } })
    expect(variant.priceDelta).toBe(-500)

    await prisma.variant.delete({ where: { id: variant.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: variant.id } })
  })

  it('refuse un prix de vente résultant nul ou négatif', async () => {
    const sku = `${PREFIXE}sku-gratuit`
    const state = await createVariant(
      productId,
      { success: false, errors: {}, initialValues: {} },
      formData({ label: 'Taille bradée', sku, priceDelta: '-10000', stock: '1' }),
    )
    expect(state.success).toBe(false)
    expect(state.errors.priceDelta?.[0]).toMatch(/positif/)

    const count = await prisma.variant.count({ where: { sku } })
    expect(count).toBe(0)
  })

  it('refuse un SKU déjà utilisé, avec un message dédié distinct de celui du libellé', async () => {
    const state = await createVariant(
      productId,
      { success: false, errors: {}, initialValues: {} },
      // `${PREFIXE}sku` est déjà pris par la fixture `variantId` créée dans beforeAll.
      formData({ label: 'Libellé sans rapport', sku: `${PREFIXE}sku`, priceDelta: '0', stock: '1' }),
    )
    expect(state.success).toBe(false)
    expect(state.errors.sku?.[0]).toMatch(/SKU.*déjà utilisé/)
    expect(state.errors.label).toBeUndefined()
  })

  it('refuse un libellé déjà utilisé pour ce produit, avec un message dédié distinct de celui du SKU', async () => {
    const state = await createVariant(
      productId,
      { success: false, errors: {}, initialValues: {} },
      // 'Unique' est déjà le libellé de la fixture `variantId` créée dans beforeAll, pour
      // ce même produit.
      formData({ label: 'Unique', sku: `${PREFIXE}sku-libelle-dup`, priceDelta: '0', stock: '1' }),
    )
    expect(state.success).toBe(false)
    expect(state.errors.label?.[0]).toMatch(/libellé.*existe déjà/)
    expect(state.errors.sku).toBeUndefined()
  })
})

describe('uploadMedia (chemin nominal)', () => {
  function fileFor(mediaPath: string, width: number, extension: 'avif' | 'webp') {
    return path.join(process.cwd(), 'public', `${mediaPath}-${width}.${extension}`)
  }

  it('accepte une vraie image, écrit le média et son journal d’audit, puis nettoie les fichiers produits', async () => {
    const image = await sharp({
      create: { width: 900, height: 700, channels: 3, background: '#EDE5DA' },
    })
      .jpeg()
      .toBuffer()
    const file = new File([image], 'photo.jpg', { type: 'image/jpeg' })
    const fd = new FormData()
    fd.set('file', file)

    const countBefore = await prisma.media.count({ where: { productId } })

    const state = await uploadMedia(productId, { error: null }, fd)
    expect(state.error).toBeNull()

    const media = await prisma.media.findFirstOrThrow({
      where: { productId },
      orderBy: { position: 'desc' },
    })
    expect(media.path).toMatch(/^\/uploads\//)
    // Jamais d'alt vide à l'ajout : la valeur de départ est dérivée du nom du produit,
    // sans quoi la photo naîtrait dans un état que updateMediaAlt refuse de reproduire
    // (et partirait en vitrine sans texte alternatif).
    expect(media.alt).toBe('Produit de test admin')

    for (const width of [400, 800, 1200] as const) {
      await expect(stat(fileFor(media.path, width, 'avif'))).resolves.toBeTruthy()
      await expect(stat(fileFor(media.path, width, 'webp'))).resolves.toBeTruthy()
    }

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'Media', entityId: media.id, action: 'add_media' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.after).toEqual({ path: media.path })

    // Nettoyage via deleteMedia (Correctif 5) plutôt qu'un rm manuel : exerce du même
    // coup son chemin nominal (effacement des six fichiers produits par processImage), et
    // ne laisse rien dans public/uploads au-delà de .gitkeep.
    const deleteState = await deleteMedia(media.id, { error: null }, new FormData())
    expect(deleteState.error).toBeNull()

    for (const width of [400, 800, 1200] as const) {
      await expect(stat(fileFor(media.path, width, 'avif'))).rejects.toThrow()
      await expect(stat(fileFor(media.path, width, 'webp'))).rejects.toThrow()
    }

    const countAfter = await prisma.media.count({ where: { productId } })
    expect(countAfter).toBe(countBefore)

    // Aucun résidu sous le préfixe que CE test s'est attribué (le nom de fichier retourné
    // par processImage) : attrape une largeur ou une extension que uploadMedia aurait
    // écrite et que deleteMedia ne nettoierait pas. Aucune assertion, en revanche, sur
    // le contenu entier de public/uploads : ce dossier est une ressource globale que ce
    // fichier ne possède pas, et l'exiger vide (« il ne reste que .gitkeep ») entrait en
    // collision avec tests/server/media.test.ts, qui y écrit ses propres fichiers au même
    // moment — d'où la sérialisation de toute la suite Vitest, désormais retirée.
    const prefixe = `${path.basename(media.path)}-`
    const entries = await readdir(path.join(process.cwd(), 'public', 'uploads'))
    expect(entries.filter((entry) => entry.startsWith(prefixe))).toEqual([])

    // uploadMedia ('add_media') et deleteMedia ('delete_media') ont chacune
    // écrit leur propre ligne de journal pour ce media.id : les deux doivent disparaître,
    // pas seulement le média lui-même.
    await prisma.auditLog.deleteMany({ where: { entityId: media.id } })
  })
})

describe('updateMediaAlt', () => {
  it('modifie le texte alternatif et écrit un journal avant/après', async () => {
    const media = await prisma.media.create({
      data: { productId, path: '/uploads/alt-test', alt: 'ancien texte', position: 0, isPrimary: false },
    })

    const state = await updateMediaAlt(
      media.id,
      { error: null },
      formData({ alt: 'Bracelet en argent sur fond clair' }),
    )
    expect(state.error).toBeNull()

    const after = await prisma.media.findUniqueOrThrow({ where: { id: media.id } })
    expect(after.alt).toBe('Bracelet en argent sur fond clair')

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'Media', entityId: media.id, action: 'update_media_alt' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.before).toEqual({ alt: 'ancien texte' })
    expect(audit.after).toEqual({ alt: 'Bracelet en argent sur fond clair' })

    await prisma.media.delete({ where: { id: media.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: media.id } })
  })

  it('refuse un texte alternatif vide (ou uniquement composé d’espaces)', async () => {
    const media = await prisma.media.create({
      data: { productId, path: '/uploads/alt-vide', alt: 'texte existant', position: 0, isPrimary: false },
    })

    const state = await updateMediaAlt(media.id, { error: null }, formData({ alt: '   ' }))
    expect(state.error).toMatch(/requis/)

    const after = await prisma.media.findUniqueOrThrow({ where: { id: media.id } })
    expect(after.alt).toBe('texte existant')

    await prisma.media.delete({ where: { id: media.id } })
  })
})

describe('setPrimaryPhoto', () => {
  it('retire le drapeau des autres photos du produit avant de le poser sur celle-ci', async () => {
    const m1 = await prisma.media.create({
      data: { productId, path: '/uploads/principale-1', alt: 'a', position: 0, isPrimary: true },
    })
    const m2 = await prisma.media.create({
      data: { productId, path: '/uploads/principale-2', alt: 'b', position: 1, isPrimary: false },
    })

    const state = await setPrimaryPhoto(m2.id, { error: null }, new FormData())
    expect(state.error).toBeNull()

    const [after1, after2] = await Promise.all([
      prisma.media.findUniqueOrThrow({ where: { id: m1.id } }),
      prisma.media.findUniqueOrThrow({ where: { id: m2.id } }),
    ])
    expect(after1.isPrimary).toBe(false)
    expect(after2.isPrimary).toBe(true)

    await prisma.media.deleteMany({ where: { id: { in: [m1.id, m2.id] } } })
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [m1.id, m2.id] } } })
  })
})

describe('deleteMedia', () => {
  it('supprime la photo et promeut la suivante quand la principale est supprimée', async () => {
    const m1 = await prisma.media.create({
      data: { productId, path: '/uploads/suppr-1', alt: 'a', position: 0, isPrimary: true },
    })
    const m2 = await prisma.media.create({
      data: { productId, path: '/uploads/suppr-2', alt: 'b', position: 1, isPrimary: false },
    })

    const state = await deleteMedia(m1.id, { error: null }, new FormData())
    expect(state.error).toBeNull()

    const count = await prisma.media.count({ where: { id: m1.id } })
    expect(count).toBe(0)

    const after2 = await prisma.media.findUniqueOrThrow({ where: { id: m2.id } })
    expect(after2.isPrimary).toBe(true)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'Media', entityId: m1.id, action: 'delete_media' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.before).toMatchObject({ path: '/uploads/suppr-1', isPrimary: true })

    await prisma.media.delete({ where: { id: m2.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: m1.id } })
  })
})
