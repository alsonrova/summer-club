import { describe, it, expect, afterAll } from 'vitest'
import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { prisma } from '@/server/db'
import { traiterImage } from '@/server/media'
import { deleteProduct } from '@/server/products'

// deleteProduct est la fonction qui possède la suppression d'un produit. La cascade Prisma
// (Media.onDelete: Cascade) efface les lignes, mais aucune cascade n'atteint le disque :
// sans cette fonction, chaque appelant devait effacer lui-même les fichiers écrits par
// traiterImage — et un appelant qui l'oubliait laissait des orphelins dans public/uploads,
// un dossier servi publiquement (dette constatée le 2026-08-30 : six fichiers orphelins).
// Ces tests créent de VRAIS fichiers via traiterImage, puis assertent l'absence de résidu,
// sur disque comme en base.

const SLUG_PREFIX = 'products-test-'
const WIDTHS = [400, 800, 1200] as const
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

// Chemins réellement retournés par traiterImage, seuls noms fiables pour le nettoyage
// défensif d'afterAll (le nom sur disque porte un suffixe aléatoire — même raison que
// tests/server/media.test.ts).
const usedPaths: string[] = []

function fileFor(chemin: string, width: number, ext: 'avif' | 'webp') {
  return path.join(process.cwd(), 'public', `${chemin}-${width}.${ext}`)
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
  const files = usedPaths.flatMap((chemin) =>
    WIDTHS.flatMap((width) => [fileFor(chemin, width, 'avif'), fileFor(chemin, width, 'webp')]),
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
      create: { slug: `${SLUG_PREFIX}categorie`, nom: 'Catégorie test suppression' },
    })
    const product = await prisma.product.create({
      data: {
        slug: `${SLUG_PREFIX}produit`,
        nom: 'Produit à supprimer',
        description: 'Produit créé uniquement pour vérifier la suppression complète.',
        categoryId: category.id,
        prixBase: 10000,
      },
    })
    // Une déclinaison en plus des photos : la suppression doit traverser toutes les
    // cascades, pas seulement Media.
    await prisma.variant.create({
      data: { productId: product.id, libelle: 'Unique', sku: `${SLUG_PREFIX}sku`, stock: 1 },
    })

    // Deux photos réelles, comme en production : traiterImage écrit six fichiers chacune.
    const source = await createJpegSource()
    const media1 = await traiterImage(source, product.id)
    const media2 = await traiterImage(source, product.id)
    usedPaths.push(media1.chemin, media2.chemin)
    await prisma.media.createMany({
      data: [
        { productId: product.id, chemin: media1.chemin, alt: 'Photo 1', position: 0, isPrimary: true },
        { productId: product.id, chemin: media2.chemin, alt: 'Photo 2', position: 1 },
      ],
    })

    // Garde-fou contre un test creux : les fichiers doivent exister AVANT la suppression,
    // sans quoi les assertions d'absence ci-dessous passeraient sur un disque jamais écrit.
    await expect(stat(fileFor(media1.chemin, 400, 'avif'))).resolves.toBeTruthy()
    await expect(stat(fileFor(media2.chemin, 1200, 'webp'))).resolves.toBeTruthy()

    await deleteProduct(product.id)

    // Plus rien en base…
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull()
    expect(await prisma.media.count({ where: { productId: product.id } })).toBe(0)
    expect(await prisma.variant.count({ where: { productId: product.id } })).toBe(0)

    // …et plus rien sur disque : les douze fichiers des deux photos ont disparu.
    for (const { chemin } of [media1, media2]) {
      for (const width of WIDTHS) {
        await expect(stat(fileFor(chemin, width, 'avif'))).rejects.toThrow()
        await expect(stat(fileFor(chemin, width, 'webp'))).rejects.toThrow()
      }
    }

    // Aucun résidu sous les préfixes que ce test s'est attribués : attrape une largeur ou
    // une extension écrite en plus de celles que ce test connaît. Aucune assertion sur le
    // reste du dossier, ressource globale que ce fichier ne possède pas (même raison que
    // tests/server/media.test.ts).
    const prefixes = [media1.chemin, media2.chemin].map((c) => `${path.basename(c)}-`)
    const entries = await readdir(UPLOADS_DIR)
    expect(entries.filter((e) => prefixes.some((p) => e.startsWith(p)))).toEqual([])
  })

  it('tolère un produit déjà absent, pour que deux passes de nettoyage puissent se croiser', async () => {
    // Même raisonnement que nettoyerProduitDeTest (e2e/admin-produits.spec.ts) : un
    // nettoyage avant-test et un nettoyage après-test peuvent viser le même produit ;
    // le second ne doit pas lever.
    await expect(deleteProduct('produit-totalement-inexistant')).resolves.toBeUndefined()
  })
})
