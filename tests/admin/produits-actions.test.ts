import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { prisma } from '@/server/db'
import {
  creerProduit,
  modifierProduit,
  creerDeclinaison,
  ajusterStock,
  televerserMedia,
  reordonnerMedia,
  modifierAltMedia,
  definirPhotoPrincipale,
  supprimerMedia,
} from '@/app/admin/produits/actions'

// ajusterStock/televerserMedia/reordonnerMedia (et désormais creerProduit/modifierProduit/
// creerDeclinaison/modifierAltMedia/definirPhotoPrincipale/supprimerMedia) passent par
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
// laisserait `creerProduit` se poursuivre après l'appel, un chemin que le vrai runtime
// n'emprunte jamais) — le test du chemin nominal de creerProduit s'attend donc lui-même à
// ce que l'appel lève, une fois l'écriture en base et l'audit déjà faits.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
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
  // Chaque test qui écrit un journal d'audit sur une entité qu'il crée lui-même supprime
  // déjà cette ligne (voir chaque `it` ci-dessous) ; cette dernière passe ne couvre que
  // l'entité fixe partagée par tout le fichier (productId/variantId), pour ne laisser
  // aucune ligne orpheline en base après coup (voir Correctif 8, « résidus d'audit »).
  await prisma.auditLog.deleteMany({ where: { entiteId: { in: [productId, variantId] } } })
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

  it('chemin nominal : met à jour la position et écrit un journal avant/après', async () => {
    const media = await prisma.media.create({
      data: { productId, chemin: '/uploads/reordonner-test', alt: '', position: 0, isPrimary: false },
    })

    const etat = await reordonnerMedia(media.id, { erreur: null }, formData({ position: '4' }))
    expect(etat.erreur).toBeNull()

    const apres = await prisma.media.findUniqueOrThrow({ where: { id: media.id } })
    expect(apres.position).toBe(4)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entite: 'Media', entiteId: media.id, action: 'reordonner_media' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.avant).toEqual({ position: 0 })
    expect(audit.apres).toEqual({ position: 4 })

    await prisma.media.delete({ where: { id: media.id } })
    await prisma.auditLog.deleteMany({ where: { entiteId: media.id } })
  })
})

describe('creerProduit (chemin nominal)', () => {
  it('crée le produit en base et écrit un journal d’audit', async () => {
    const slug = `${PREFIXE}bracelet-nominal`
    const donnees = formData({
      nom: 'Bracelet Test Nominal',
      slug,
      description: 'Bracelet créé uniquement pour vérifier le chemin nominal de creerProduit.',
      categoryId,
      prixBase: '15000',
      prixAchat: '5000',
      actif: 'on',
      ordre: '3',
    })

    // redirect() (mocké ci-dessus) lève après l'écriture réussie : c'est le comportement
    // réel reproduit, pas un défaut du test.
    await expect(
      creerProduit({ succes: false, erreurs: {}, valeursInitiales: {} }, donnees),
    ).rejects.toThrow(/NEXT_REDIRECT/)

    const produit = await prisma.product.findUniqueOrThrow({ where: { slug } })
    expect(produit.nom).toBe('Bracelet Test Nominal')
    expect(produit.prixBase).toBe(15000)
    expect(produit.prixAchat).toBe(5000)
    expect(produit.ordre).toBe(3)
    expect(produit.actif).toBe(true)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entite: 'produits', entiteId: produit.id, action: 'creer' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.apres).toMatchObject({ nom: 'Bracelet Test Nominal', prixBase: 15000, ordre: 3 })

    await prisma.product.delete({ where: { id: produit.id } })
    await prisma.auditLog.deleteMany({ where: { entiteId: produit.id } })
  })

  it('refuse un slug déjà utilisé par un autre produit avec un message dédié', async () => {
    const slug = `${PREFIXE}slug-en-double`
    const existant = await prisma.product.create({
      data: {
        slug,
        nom: 'Produit déjà en place',
        description: 'Produit créé uniquement pour provoquer une collision de slug.',
        categoryId,
        prixBase: 10000,
      },
    })

    const donnees = formData({
      nom: 'Autre produit',
      slug,
      description: 'Second produit qui tente de reprendre le même slug que le premier.',
      categoryId,
      prixBase: '12000',
      prixAchat: '0',
      actif: 'on',
      ordre: '0',
    })

    const etat = await creerProduit({ succes: false, erreurs: {}, valeursInitiales: {} }, donnees)
    expect(etat.succes).toBe(false)
    expect(etat.erreurs.slug?.[0]).toMatch(/slug.*déjà utilisé/)

    const compte = await prisma.product.count({ where: { slug, nom: 'Autre produit' } })
    expect(compte).toBe(0)

    await prisma.product.delete({ where: { id: existant.id } })
  })
})

describe('modifierProduit (chemin nominal)', () => {
  it('met à jour le produit et écrit un journal symétrique (mêmes clés avant/après)', async () => {
    const produit = await prisma.product.create({
      data: {
        slug: `${PREFIXE}modif-produit`,
        nom: 'Produit à modifier',
        description: 'Produit créé uniquement pour tester le chemin nominal de modifierProduit.',
        categoryId,
        prixBase: 20000,
        ordre: 1,
      },
    })

    const donnees = formData({
      nom: 'Produit modifié',
      slug: `${PREFIXE}modif-produit`,
      description: 'Produit créé uniquement pour tester modifierProduit, désormais modifié.',
      categoryId,
      prixBase: '25000',
      prixAchat: '9000',
      actif: 'on',
      ordre: '2',
    })

    const etat = await modifierProduit(
      produit.id,
      { succes: false, erreurs: {}, valeursInitiales: {} },
      donnees,
    )
    expect(etat.succes).toBe(true)

    const apres = await prisma.product.findUniqueOrThrow({ where: { id: produit.id } })
    expect(apres.nom).toBe('Produit modifié')
    expect(apres.prixBase).toBe(25000)
    expect(apres.ordre).toBe(2)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entite: 'produits', entiteId: produit.id, action: 'modifier' },
      orderBy: { createdAt: 'desc' },
    })
    const avant = audit.avant as Record<string, unknown>
    const apresAudit = audit.apres as Record<string, unknown>
    // Correctif 8 (revue de la tâche 11) : `avant` restreint aux mêmes clés que `apres`,
    // pour rester comparable champ à champ — sans quoi `avant` porterait aussi des dates et
    // des colonnes absentes du formulaire.
    expect(Object.keys(avant).sort()).toEqual(Object.keys(apresAudit).sort())
    expect(avant['prixBase']).toBe(20000)
    expect(apresAudit['prixBase']).toBe(25000)

    await prisma.product.delete({ where: { id: produit.id } })
    await prisma.auditLog.deleteMany({ where: { entiteId: produit.id } })
  })

  it('refuse un slug déjà utilisé par un autre produit avec un message dédié', async () => {
    const autre = await prisma.product.create({
      data: {
        slug: `${PREFIXE}modif-collision-cible`,
        nom: 'Produit cible',
        description: 'Produit dont le slug sera revendiqué par un autre.',
        categoryId,
        prixBase: 10000,
      },
    })
    const produit = await prisma.product.create({
      data: {
        slug: `${PREFIXE}modif-collision-source`,
        nom: 'Produit source',
        description: 'Produit dont on tente de changer le slug pour celui d’un autre.',
        categoryId,
        prixBase: 10000,
      },
    })

    const donnees = formData({
      nom: 'Produit source',
      slug: `${PREFIXE}modif-collision-cible`,
      description: 'Produit dont on tente de changer le slug pour celui d’un autre.',
      categoryId,
      prixBase: '10000',
      prixAchat: '0',
      actif: 'on',
      ordre: '0',
    })

    const etat = await modifierProduit(
      produit.id,
      { succes: false, erreurs: {}, valeursInitiales: {} },
      donnees,
    )
    expect(etat.succes).toBe(false)
    expect(etat.erreurs.slug?.[0]).toMatch(/slug.*déjà utilisé/)

    await prisma.product.deleteMany({ where: { id: { in: [autre.id, produit.id] } } })
  })
})

describe('creerDeclinaison', () => {
  it('crée la déclinaison en base et écrit un journal d’audit (chemin nominal)', async () => {
    const sku = `${PREFIXE}sku-L`
    const etat = await creerDeclinaison(
      productId,
      { succes: false, erreurs: {}, valeursInitiales: {} },
      formData({ libelle: 'Taille L', sku, deltaPrix: '1500', stock: '3' }),
    )
    expect(etat.succes).toBe(true)

    const variant = await prisma.variant.findFirstOrThrow({ where: { sku } })
    expect(variant.deltaPrix).toBe(1500)
    expect(variant.stock).toBe(3)
    expect(variant.productId).toBe(productId)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entite: 'Variant', entiteId: variant.id, action: 'creer' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.apres).toMatchObject({ libelle: 'Taille L', sku, deltaPrix: 1500, stock: 3 })

    await prisma.variant.delete({ where: { id: variant.id } })
    await prisma.auditLog.deleteMany({ where: { entiteId: variant.id } })
  })

  it('accepte un écart de prix négatif tant que le prix de vente résultant reste positif', async () => {
    const sku = `${PREFIXE}sku-S`
    // productId a prixBase: 10000 (fixture ci-dessus) ; -500 donne un prix résultant de
    // 9500, toujours positif.
    const etat = await creerDeclinaison(
      productId,
      { succes: false, erreurs: {}, valeursInitiales: {} },
      formData({ libelle: 'Taille S', sku, deltaPrix: '-500', stock: '1' }),
    )
    expect(etat.succes).toBe(true)

    const variant = await prisma.variant.findFirstOrThrow({ where: { sku } })
    expect(variant.deltaPrix).toBe(-500)

    await prisma.variant.delete({ where: { id: variant.id } })
    await prisma.auditLog.deleteMany({ where: { entiteId: variant.id } })
  })

  it('refuse un prix de vente résultant nul ou négatif', async () => {
    const sku = `${PREFIXE}sku-gratuit`
    const etat = await creerDeclinaison(
      productId,
      { succes: false, erreurs: {}, valeursInitiales: {} },
      formData({ libelle: 'Taille bradée', sku, deltaPrix: '-10000', stock: '1' }),
    )
    expect(etat.succes).toBe(false)
    expect(etat.erreurs.deltaPrix?.[0]).toMatch(/positif/)

    const compte = await prisma.variant.count({ where: { sku } })
    expect(compte).toBe(0)
  })

  it('refuse un SKU déjà utilisé, avec un message dédié distinct de celui du libellé', async () => {
    const etat = await creerDeclinaison(
      productId,
      { succes: false, erreurs: {}, valeursInitiales: {} },
      // `${PREFIXE}sku` est déjà pris par la fixture `variantId` créée dans beforeAll.
      formData({ libelle: 'Libellé sans rapport', sku: `${PREFIXE}sku`, deltaPrix: '0', stock: '1' }),
    )
    expect(etat.succes).toBe(false)
    expect(etat.erreurs.sku?.[0]).toMatch(/SKU.*déjà utilisé/)
    expect(etat.erreurs.libelle).toBeUndefined()
  })

  it('refuse un libellé déjà utilisé pour ce produit, avec un message dédié distinct de celui du SKU', async () => {
    const etat = await creerDeclinaison(
      productId,
      { succes: false, erreurs: {}, valeursInitiales: {} },
      // 'Unique' est déjà le libellé de la fixture `variantId` créée dans beforeAll, pour
      // ce même produit.
      formData({ libelle: 'Unique', sku: `${PREFIXE}sku-libelle-dup`, deltaPrix: '0', stock: '1' }),
    )
    expect(etat.succes).toBe(false)
    expect(etat.erreurs.libelle?.[0]).toMatch(/libellé.*existe déjà/)
    expect(etat.erreurs.sku).toBeUndefined()
  })
})

describe('televerserMedia (chemin nominal)', () => {
  const DOSSIER_UPLOADS = path.join(process.cwd(), 'public', 'uploads')

  function fichierPour(chemin: string, largeur: number, extension: 'avif' | 'webp') {
    return path.join(process.cwd(), 'public', `${chemin}-${largeur}.${extension}`)
  }

  it('accepte une vraie image, écrit le média et son journal d’audit, puis nettoie les fichiers produits', async () => {
    const image = await sharp({
      create: { width: 900, height: 700, channels: 3, background: '#EDE5DA' },
    })
      .jpeg()
      .toBuffer()
    const fichier = new File([image], 'photo.jpg', { type: 'image/jpeg' })
    const fd = new FormData()
    fd.set('fichier', fichier)

    const avantCompte = await prisma.media.count({ where: { productId } })

    const etat = await televerserMedia(productId, { erreur: null }, fd)
    expect(etat.erreur).toBeNull()

    const media = await prisma.media.findFirstOrThrow({
      where: { productId },
      orderBy: { position: 'desc' },
    })
    expect(media.chemin).toMatch(/^\/uploads\//)

    for (const largeur of [400, 800, 1200] as const) {
      await expect(stat(fichierPour(media.chemin, largeur, 'avif'))).resolves.toBeTruthy()
      await expect(stat(fichierPour(media.chemin, largeur, 'webp'))).resolves.toBeTruthy()
    }

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entite: 'Media', entiteId: media.id, action: 'ajout_media' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.apres).toEqual({ chemin: media.chemin })

    // Nettoyage via supprimerMedia (Correctif 5) plutôt qu'un rm manuel : exerce du même
    // coup son chemin nominal (effacement des six fichiers produits par traiterImage), et
    // ne laisse rien dans public/uploads au-delà de .gitkeep.
    const etatSuppression = await supprimerMedia(media.id, { erreur: null }, new FormData())
    expect(etatSuppression.erreur).toBeNull()

    for (const largeur of [400, 800, 1200] as const) {
      await expect(stat(fichierPour(media.chemin, largeur, 'avif'))).rejects.toThrow()
      await expect(stat(fichierPour(media.chemin, largeur, 'webp'))).rejects.toThrow()
    }

    const apresCompte = await prisma.media.count({ where: { productId } })
    expect(apresCompte).toBe(avantCompte)

    const entrees = await readdir(DOSSIER_UPLOADS)
    expect(entrees.sort()).toEqual(['.gitkeep'])

    // televerserMedia ('ajout_media') et supprimerMedia ('supprimer_media') ont chacune
    // écrit leur propre ligne de journal pour ce media.id : les deux doivent disparaître,
    // pas seulement le média lui-même.
    await prisma.auditLog.deleteMany({ where: { entiteId: media.id } })
  })
})

describe('modifierAltMedia', () => {
  it('modifie le texte alternatif et écrit un journal avant/après', async () => {
    const media = await prisma.media.create({
      data: { productId, chemin: '/uploads/alt-test', alt: 'ancien texte', position: 0, isPrimary: false },
    })

    const etat = await modifierAltMedia(
      media.id,
      { erreur: null },
      formData({ alt: 'Bracelet en argent sur fond clair' }),
    )
    expect(etat.erreur).toBeNull()

    const apres = await prisma.media.findUniqueOrThrow({ where: { id: media.id } })
    expect(apres.alt).toBe('Bracelet en argent sur fond clair')

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entite: 'Media', entiteId: media.id, action: 'modifier_alt_media' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.avant).toEqual({ alt: 'ancien texte' })
    expect(audit.apres).toEqual({ alt: 'Bracelet en argent sur fond clair' })

    await prisma.media.delete({ where: { id: media.id } })
    await prisma.auditLog.deleteMany({ where: { entiteId: media.id } })
  })

  it('refuse un texte alternatif vide (ou uniquement composé d’espaces)', async () => {
    const media = await prisma.media.create({
      data: { productId, chemin: '/uploads/alt-vide', alt: 'texte existant', position: 0, isPrimary: false },
    })

    const etat = await modifierAltMedia(media.id, { erreur: null }, formData({ alt: '   ' }))
    expect(etat.erreur).toMatch(/requis/)

    const apres = await prisma.media.findUniqueOrThrow({ where: { id: media.id } })
    expect(apres.alt).toBe('texte existant')

    await prisma.media.delete({ where: { id: media.id } })
  })
})

describe('definirPhotoPrincipale', () => {
  it('retire le drapeau des autres photos du produit avant de le poser sur celle-ci', async () => {
    const m1 = await prisma.media.create({
      data: { productId, chemin: '/uploads/principale-1', alt: 'a', position: 0, isPrimary: true },
    })
    const m2 = await prisma.media.create({
      data: { productId, chemin: '/uploads/principale-2', alt: 'b', position: 1, isPrimary: false },
    })

    const etat = await definirPhotoPrincipale(m2.id, { erreur: null }, new FormData())
    expect(etat.erreur).toBeNull()

    const [apres1, apres2] = await Promise.all([
      prisma.media.findUniqueOrThrow({ where: { id: m1.id } }),
      prisma.media.findUniqueOrThrow({ where: { id: m2.id } }),
    ])
    expect(apres1.isPrimary).toBe(false)
    expect(apres2.isPrimary).toBe(true)

    await prisma.media.deleteMany({ where: { id: { in: [m1.id, m2.id] } } })
    await prisma.auditLog.deleteMany({ where: { entiteId: { in: [m1.id, m2.id] } } })
  })
})

describe('supprimerMedia', () => {
  it('supprime la photo et promeut la suivante quand la principale est supprimée', async () => {
    const m1 = await prisma.media.create({
      data: { productId, chemin: '/uploads/suppr-1', alt: 'a', position: 0, isPrimary: true },
    })
    const m2 = await prisma.media.create({
      data: { productId, chemin: '/uploads/suppr-2', alt: 'b', position: 1, isPrimary: false },
    })

    const etat = await supprimerMedia(m1.id, { erreur: null }, new FormData())
    expect(etat.erreur).toBeNull()

    const compte = await prisma.media.count({ where: { id: m1.id } })
    expect(compte).toBe(0)

    const apres2 = await prisma.media.findUniqueOrThrow({ where: { id: m2.id } })
    expect(apres2.isPrimary).toBe(true)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entite: 'Media', entiteId: m1.id, action: 'supprimer_media' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.avant).toMatchObject({ chemin: '/uploads/suppr-1', isPrimary: true })

    await prisma.media.delete({ where: { id: m2.id } })
    await prisma.auditLog.deleteMany({ where: { entiteId: m1.id } })
  })
})
