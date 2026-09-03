import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { prisma } from '@/server/db'
import { processImage } from '@/server/media'
import { deleteProduct, listProducts, loadProduct } from '@/server/products'

// deleteProduct est la fonction qui possède la suppression d'un produit. La cascade Prisma
// (Media.onDelete: Cascade) efface les lignes, mais aucune cascade n'atteint le disque :
// sans cette fonction, chaque appelant devait effacer lui-même les fichiers écrits par
// processImage — et un appelant qui l'oubliait laissait des orphelins dans public/uploads,
// un dossier servi publiquement (dette constatée le 2026-08-30 : six fichiers orphelins).
// Ces tests créent de VRAIS fichiers via processImage, puis assertent l'absence de résidu,
// sur disque comme en base.

const SLUG_PREFIX = 'products-test-'
const WIDTHS = [400, 800, 1200] as const
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

// Chemins réellement retournés par processImage, seuls noms fiables pour le nettoyage
// défensif d'afterAll (le nom sur disque porte un suffixe aléatoire — même raison que
// tests/server/media.test.ts).
const usedPaths: string[] = []

function fileFor(mediaPath: string, width: number, ext: 'avif' | 'webp') {
  return path.join(process.cwd(), 'public', `${mediaPath}-${width}.${ext}`)
}

async function createJpegSource() {
  return sharp({
    create: { width: 600, height: 600, channels: 3, background: '#EDE5DA' },
  }).jpeg().toBuffer()
}

afterAll(async () => {
  // Nettoyage défensif si une assertion a échoué avant la suppression : fichiers d'abord
  // (rm force ignore un fichier déjà effacé), puis lignes en base, bornés aux slugs de CE
  // fichier — jamais de deleteMany sans filtre sur une table partagée.
  const files = usedPaths.flatMap((mediaPath) =>
    WIDTHS.flatMap((width) => [fileFor(mediaPath, width, 'avif'), fileFor(mediaPath, width, 'webp')]),
  )
  await Promise.all(files.map((f) => rm(f, { force: true })))
  await prisma.product.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } })
  await prisma.category.deleteMany({ where: { slug: `${SLUG_PREFIX}categorie` } })
  await prisma.$disconnect()
})

describe('deleteProduct', () => {
  it("supprime le produit, ses lignes en cascade, et efface du disque les fichiers de toutes ses photos", async () => {
    const category = await prisma.category.upsert({
      where: { slug: `${SLUG_PREFIX}categorie` },
      update: {},
      create: { slug: `${SLUG_PREFIX}categorie`, name: 'Catégorie test suppression' },
    })
    const product = await prisma.product.create({
      data: {
        slug: `${SLUG_PREFIX}produit`,
        name: 'Produit à supprimer',
        description: 'Produit créé uniquement pour vérifier la suppression complète.',
        categoryId: category.id,
        basePrice: 10000,
      },
    })
    // Une déclinaison en plus des photos : la suppression doit traverser toutes les
    // cascades, pas seulement Media.
    await prisma.variant.create({
      data: { productId: product.id, label: 'Unique', sku: `${SLUG_PREFIX}sku`, stock: 1 },
    })

    // Deux photos réelles, comme en production : processImage écrit six fichiers chacune.
    const source = await createJpegSource()
    const media1 = await processImage(source, product.id)
    const media2 = await processImage(source, product.id)
    usedPaths.push(media1.path, media2.path)
    await prisma.media.createMany({
      data: [
        { productId: product.id, path: media1.path, alt: 'Photo 1', position: 0, isPrimary: true },
        { productId: product.id, path: media2.path, alt: 'Photo 2', position: 1 },
      ],
    })

    // Garde-fou contre un test creux : les fichiers doivent exister AVANT la suppression,
    // sans quoi les assertions d'absence ci-dessous passeraient sur un disque jamais écrit.
    await expect(stat(fileFor(media1.path, 400, 'avif'))).resolves.toBeTruthy()
    await expect(stat(fileFor(media2.path, 1200, 'webp'))).resolves.toBeTruthy()

    await deleteProduct(product.id)

    // Plus rien en base…
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull()
    expect(await prisma.media.count({ where: { productId: product.id } })).toBe(0)
    expect(await prisma.variant.count({ where: { productId: product.id } })).toBe(0)

    // …et plus rien sur disque : les douze fichiers des deux photos ont disparu.
    for (const { path: mediaPath } of [media1, media2]) {
      for (const width of WIDTHS) {
        await expect(stat(fileFor(mediaPath, width, 'avif'))).rejects.toThrow()
        await expect(stat(fileFor(mediaPath, width, 'webp'))).rejects.toThrow()
      }
    }

    // Aucun résidu sous les préfixes que ce test s'est attribués : attrape une largeur ou
    // une extension écrite en plus de celles que ce test connaît. Aucune assertion sur le
    // reste du dossier, ressource globale que ce fichier ne possède pas (même raison que
    // tests/server/media.test.ts).
    const prefixes = [media1.path, media2.path].map((c) => `${path.basename(c)}-`)
    const entries = await readdir(UPLOADS_DIR)
    expect(entries.filter((e) => prefixes.some((p) => e.startsWith(p)))).toEqual([])
  })

  it('tolère un produit déjà absent, pour que deux passes de nettoyage puissent se croiser', async () => {
    // Même raisonnement que cleanUpTestProduct (e2e/admin-products.spec.ts) : un
    // nettoyage avant-test et un nettoyage après-test peuvent viser le même produit ;
    // le second ne doit pas lever.
    await expect(deleteProduct('produit-totalement-inexistant')).resolves.toBeUndefined()
  })
})

// Lecture publique du catalogue et d'une fiche. Ces tests possèdent leurs propres lignes,
// toutes sous STOREFRONT_PREFIX, et n'assertent que sur elles : les lignes de seed
// (collier-vahine, VAH-45) sont mutées en parallèle par tests/server/orders.test.ts
// (actif, stock, prix de base), et une assertion posée dessus serait intermittente par
// construction (docs/CONVENTIONS.md § 6.3). Le catalogue est donc interrogé par le slug de
// la catégorie de CE fichier, jamais en entier, sauf pour vérifier qu'il contient bien
// nos produits.
const STOREFRONT_PREFIX = 'storefront-test-'
const STOREFRONT_CATEGORY = `${STOREFRONT_PREFIX}categorie`
// Portée `product` sur notre seul produit actif : une promotion de portée `all` toucherait
// les prix attendus par les autres fichiers de test qui tournent en même temps.
const STOREFRONT_PROMOTION = 'Promotion vitrine (test) -10 %'

const ACTIVE_SLUG = `${STOREFRONT_PREFIX}actif`
const INACTIVE_SLUG = `${STOREFRONT_PREFIX}inactif`
const SOLD_OUT_SLUG = `${STOREFRONT_PREFIX}epuise`

// Plus de 155 caractères, pour que la troncature de la description en meta soit observable.
const SOLD_OUT_DESCRIPTION =
  'Bracelet créé pour les tests de la vitrine, jamais visible en production. Sa description ' +
  'dépasse volontairement les cent cinquante-cinq caractères pour vérifier la troncature ' +
  'de la meta description.'

async function cleanUpStorefrontFixtures() {
  await prisma.promotion.deleteMany({ where: { name: STOREFRONT_PROMOTION } })
  await prisma.product.deleteMany({ where: { slug: { startsWith: STOREFRONT_PREFIX } } })
  await prisma.category.deleteMany({ where: { slug: STOREFRONT_CATEGORY } })
}

describe('catalogue et fiche produit', () => {
  beforeAll(async () => {
    // Rattrape une exécution précédente interrompue avant son nettoyage.
    await cleanUpStorefrontFixtures()

    const category = await prisma.category.create({
      data: { slug: STOREFRONT_CATEGORY, name: 'Catégorie vitrine (test)' },
    })

    const active = await prisma.product.create({
      data: {
        slug: ACTIVE_SLUG,
        name: 'Bracelet vitrine',
        description: 'Bracelet créé pour les tests de la vitrine, jamais visible en production.',
        categoryId: category.id,
        basePrice: 30000,
        displayOrder: 1,
        metaTitle: 'Bracelet vitrine — titre renseigné',
        metaDescription: 'Meta description renseignée à la main.',
        // Une déclinaison en stock sans écart, une épuisée avec écart de prix : de quoi
        // distinguer la disponibilité par déclinaison et l'assiette de la promotion.
        variants: {
          create: [
            { label: '40 cm', sku: `${STOREFRONT_PREFIX}40`, stock: 2 },
            { label: '45 cm', sku: `${STOREFRONT_PREFIX}45`, stock: 0, priceDelta: 5000 },
          ],
        },
        // La seconde photo est insérée AVANT la première : seul un tri explicite par
        // position peut rendre la photo 1 en premier. Sans texte alternatif, pour
        // vérifier le repli sur le nom du produit. Aucun fichier n'existe sur disque :
        // la lecture du catalogue ne touche pas au disque.
        media: {
          create: [
            { path: `/uploads/${STOREFRONT_PREFIX}photo-2`, alt: '', position: 1 },
            { path: `/uploads/${STOREFRONT_PREFIX}photo-1`, alt: 'Bracelet à plat', position: 0, isPrimary: true },
          ],
        },
      },
    })

    await prisma.product.create({
      data: {
        slug: INACTIVE_SLUG,
        name: 'Bracelet retiré (test)',
        description: 'Produit désactivé : il ne doit apparaître nulle part en boutique.',
        categoryId: category.id,
        basePrice: 20000,
        active: false,
        displayOrder: 2,
        variants: { create: [{ label: 'Unique', sku: `${STOREFRONT_PREFIX}retire`, stock: 5 }] },
      },
    })

    await prisma.product.create({
      data: {
        slug: SOLD_OUT_SLUG,
        name: 'Bracelet épuisé (test)',
        description: SOLD_OUT_DESCRIPTION,
        categoryId: category.id,
        basePrice: 25000,
        displayOrder: 3,
        variants: { create: [{ label: 'Unique', sku: `${STOREFRONT_PREFIX}epuise`, stock: 0 }] },
      },
    })

    await prisma.promotion.create({
      data: {
        name: STOREFRONT_PROMOTION, type: 'percent', value: 10,
        scope: 'product', targetId: active.id, active: true,
      },
    })
  })

  afterAll(cleanUpStorefrontFixtures)

  describe('listProducts', () => {
    it("retourne les produits actifs de la catégorie, dans l'ordre d'affichage, avec leur prix effectif", async () => {
      const products = await listProducts(STOREFRONT_CATEGORY)
      const slugs = products.map((p) => p.slug)

      expect(products.every((p) => p.slug.startsWith(STOREFRONT_PREFIX))).toBe(true)
      expect(slugs.indexOf(ACTIVE_SLUG)).toBeGreaterThanOrEqual(0)
      expect(slugs.indexOf(ACTIVE_SLUG)).toBeLessThan(slugs.indexOf(SOLD_OUT_SLUG))

      // 30 000 remisés de 10 % par la promotion de ce fichier.
      expect(products.find((p) => p.slug === ACTIVE_SLUG)).toMatchObject({
        name: 'Bracelet vitrine', initialPrice: 30000, finalPrice: 27000, inStock: true,
      })
    })

    it("liste toutes les catégories quand aucun slug n'est fourni", async () => {
      const slugs = (await listProducts()).map((p) => p.slug)
      expect(slugs).toEqual(expect.arrayContaining([ACTIVE_SLUG, SOLD_OUT_SLUG]))
    })

    it('exclut les produits inactifs', async () => {
      const products = await listProducts(STOREFRONT_CATEGORY)
      expect(products.find((p) => p.slug === INACTIVE_SLUG)).toBeUndefined()
    })

    it('marque un produit sans stock comme indisponible', async () => {
      const products = await listProducts(STOREFRONT_CATEGORY)
      expect(products.find((p) => p.slug === SOLD_OUT_SLUG)?.inStock).toBe(false)
      // Une seule déclinaison en stock suffit : le bracelet actif en a une épuisée.
      expect(products.find((p) => p.slug === ACTIVE_SLUG)?.inStock).toBe(true)
    })

    it('sert les deux premières photos en 800 px, ou une image de repli sans photo', async () => {
      const products = await listProducts(STOREFRONT_CATEGORY)
      expect(products.find((p) => p.slug === ACTIVE_SLUG)).toMatchObject({
        image: `/uploads/${STOREFRONT_PREFIX}photo-1-800.avif`,
        secondaryImage: `/uploads/${STOREFRONT_PREFIX}photo-2-800.avif`,
      })
      expect(products.find((p) => p.slug === SOLD_OUT_SLUG)).toMatchObject({
        image: '/placeholder-800.avif', secondaryImage: null,
      })
    })
  })

  describe('loadProduct', () => {
    it('retourne null pour un slug inconnu', async () => {
      expect(await loadProduct(`${STOREFRONT_PREFIX}inconnu`)).toBeNull()
    })

    it('retourne null pour un produit inactif, comme pour un slug inconnu', async () => {
      expect(await loadProduct(INACTIVE_SLUG)).toBeNull()
    })

    it('porte le prix effectif, la disponibilité et la description du produit', async () => {
      const detail = await loadProduct(ACTIVE_SLUG)
      expect(detail).toMatchObject({
        slug: ACTIVE_SLUG, name: 'Bracelet vitrine',
        description: 'Bracelet créé pour les tests de la vitrine, jamais visible en production.',
        initialPrice: 30000, finalPrice: 27000, inStock: true,
        metaTitle: 'Bracelet vitrine — titre renseigné',
        metaDescription: 'Meta description renseignée à la main.',
      })
    })

    it('retourne les déclinaisons avec leur disponibilité et leur prix', async () => {
      const detail = await loadProduct(ACTIVE_SLUG)
      // Même assiette que createOrder (src/server/orders.ts) : la promotion s'applique au
      // prix de base AUGMENTÉ de l'écart — (30 000 + 5 000) remisés de 10 % = 31 500, et
      // non 27 000 + 5 000 = 32 000. Une fiche qui afficherait 32 000 pour une commande
      // facturée 31 500 serait un défaut, quel que soit le sens de l'écart.
      expect(detail?.variants).toEqual([
        expect.objectContaining({ label: '40 cm', price: 27000, initialPrice: 30000, available: true }),
        expect.objectContaining({ label: '45 cm', price: 31500, initialPrice: 35000, available: false }),
      ])
      expect(detail?.variants.every((v) => typeof v.id === 'string' && v.id.length > 0)).toBe(true)
    })

    it('expose les photos en 1200 px, triées par position, avec le nom du produit en texte alternatif de repli', async () => {
      const detail = await loadProduct(ACTIVE_SLUG)
      expect(detail?.image).toBe(`/uploads/${STOREFRONT_PREFIX}photo-1-1200.avif`)
      expect(detail?.images).toEqual([
        { path: `/uploads/${STOREFRONT_PREFIX}photo-1-1200.avif`, alt: 'Bracelet à plat' },
        { path: `/uploads/${STOREFRONT_PREFIX}photo-2-1200.avif`, alt: 'Bracelet vitrine' },
      ])
    })

    it("remplace les photos absentes par l'image de repli, pour que la fiche garde sa galerie", async () => {
      const detail = await loadProduct(SOLD_OUT_SLUG)
      expect(detail?.image).toBe('/placeholder-1200.avif')
      expect(detail?.images).toEqual([{ path: '/placeholder-1200.avif', alt: 'Bracelet épuisé (test)' }])
    })

    it('complète les métadonnées absentes à partir du nom et de la description', async () => {
      const detail = await loadProduct(SOLD_OUT_SLUG)
      expect(detail?.metaTitle).toBe('Bracelet épuisé (test) — Summer Club')
      expect(detail?.metaDescription).toBe(SOLD_OUT_DESCRIPTION.slice(0, 155))
      expect(detail?.metaDescription).toHaveLength(155)
    })
  })
})
