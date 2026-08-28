import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@/server/db'
import {
  listerAvisPagines,
  AVIS_PAR_PAGE,
  type DelegateListeAvis,
} from '@/app/admin/avis/query'

// Pendant de tests/admin/commandes-query.test.ts pour les avis : vérifie que la liste
// interroge réellement la base (comptage + skip/take) au lieu de charger toute la table pour
// la découper en mémoire, que son tri est TOTAL donc déterministe, et que ses deux filtres
// fonctionnent — y compris `epingle: false`, qu'un `if (filtres.epingle)` naïf laisserait
// tomber.
//
// La table Review est un état global que ce fichier ne possède pas, et `FiltresAvis` n'offre
// aucun filtre par produit pour s'y borner. C'est le DELEGATE injecté qui joue ce rôle :
// `listerAvisPagines` prend son delegate en paramètre, on lui en passe un qui ajoute
// `productId` à chaque `where`. Les avis des autres fichiers, qui tournent en parallèle
// (vitest.config.ts), restent invisibles d'ici — et ceux d'ici invisibles d'eux.
const SLUG_CATEGORIE = 'test-avis-query-categorie'
const SLUG_PRODUIT = 'test-avis-query-produit'
const NOM_PRODUIT = 'Produit de test (liste des avis)'
const TOTAL = AVIS_PAR_PAGE + 5
const EPINGLES = 3

// Horodatage identique pour tous : c'est le cas réel qui casse un tri sur `createdAt` seul
// (un import, une rafale). Voir le test de stabilité plus bas.
const MEME_INSTANT = new Date('2026-08-01T10:00:00.000Z')

let productId: string

function statutDe(i: number): 'en_attente' | 'publie' | 'rejete' {
  if (i < EPINGLES) return 'publie'
  return i % 3 === 0 ? 'publie' : i % 3 === 1 ? 'en_attente' : 'rejete'
}

async function purger() {
  const miens = await prisma.review.findMany({ where: { productId }, select: { id: true } })
  const ids = miens.map((a) => a.id)
  if (ids.length === 0) return
  await prisma.auditLog.deleteMany({ where: { entite: 'Review', entiteId: { in: ids } } })
  await prisma.review.deleteMany({ where: { id: { in: ids } } })
}

/** Delegate borné à MES avis — voir l'en-tête de fichier. */
function mesAvis(): DelegateListeAvis {
  return {
    count: ({ where }) => prisma.review.count({ where: { ...where, productId } }),
    findMany: (args) => prisma.review.findMany({ ...args, where: { ...args.where, productId } }),
  }
}

beforeAll(async () => {
  const categorie = await prisma.category.upsert({
    where: { slug: SLUG_CATEGORIE },
    update: {},
    create: { slug: SLUG_CATEGORIE, nom: 'Catégorie de test (liste des avis)', ordre: 996 },
  })
  const produit = await prisma.product.upsert({
    where: { slug: SLUG_PRODUIT },
    update: { nom: NOM_PRODUIT, categoryId: categorie.id },
    create: {
      slug: SLUG_PRODUIT,
      nom: NOM_PRODUIT,
      description: 'Jeu de données réservé à tests/admin/avis-query.test.ts.',
      categoryId: categorie.id,
      prixBase: 45000,
    },
  })
  productId = produit.id

  // Défensif : rattrape une exécution précédente interrompue (Ctrl-C, crash du worker), de
  // sorte que la suite reparte d'une base laissée dans n'importe quel état.
  await purger()

  for (let i = 0; i < TOTAL; i++) {
    await prisma.review.create({
      data: {
        productId,
        auteur: `Autrice ${String(i).padStart(2, '0')}`,
        note: (i % 5) + 1,
        texte: 'Très joli collier, livré rapidement.',
        source: i % 2 === 0 ? 'importe' : 'verifie',
        statut: statutDe(i),
        epingle: i < EPINGLES,
        createdAt: MEME_INSTANT,
      },
    })
  }
})

afterAll(async () => {
  await purger()
  await prisma.product.deleteMany({ where: { slug: SLUG_PRODUIT } })
  await prisma.category.deleteMany({ where: { slug: SLUG_CATEGORIE } })
  await prisma.$disconnect()
})

// `vitest.config.ts` n'active pas `restoreMocks` : un `mockRestore()` en fin de test ne
// s'exécuterait pas si une assertion échouait avant lui, et l'espion resterait posé sur
// `prisma.review` pour les tests suivants du fichier.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('listerAvisPagines', () => {
  it('interroge la base avec skip/take plutôt que de charger tous les avis', async () => {
    const espionFindMany = vi.spyOn(prisma.review, 'findMany')
    const espionCount = vi.spyOn(prisma.review, 'count')

    const resultat = await listerAvisPagines(mesAvis(), { page: 1 })

    expect(espionCount).toHaveBeenCalled()
    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: AVIS_PAR_PAGE }),
    )
    expect(resultat.lignes).toHaveLength(AVIS_PAR_PAGE)
    expect(resultat.total).toBe(TOTAL)
    expect(resultat.totalPages).toBe(2)
  })

  it('décale bien skip sur la seconde page', async () => {
    const espionFindMany = vi.spyOn(prisma.review, 'findMany')

    const resultat = await listerAvisPagines(mesAvis(), { page: 2 })

    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: AVIS_PAR_PAGE, take: AVIS_PAR_PAGE }),
    )
    expect(resultat.lignes).toHaveLength(TOTAL - AVIS_PAR_PAGE)
    expect(resultat.page).toBe(2)
  })

  it("trie sur une clé unique en dernier critère, sans quoi un même avis peut sortir sur deux pages", async () => {
    // L'espion est ce qui donne sa valeur protectrice à ce test : les 25 avis partagent le
    // même `createdAt`, mais PostgreSQL renvoie en pratique un ordre stable tant que rien ne
    // le perturbe — un retour en arrière sur le dernier critère de tri ne serait donc pas
    // détecté par les seules lignes obtenues.
    const espionFindMany = vi.spyOn(prisma.review, 'findMany')

    const page1 = await listerAvisPagines(mesAvis(), { page: 1 })
    const page2 = await listerAvisPagines(mesAvis(), { page: 2 })

    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ epingle: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
    )

    const ids = [...page1.lignes.map((l) => l.id), ...page2.lignes.map((l) => l.id)]
    // Ni doublon d'une page à l'autre, ni ligne oubliée.
    expect(new Set(ids).size).toBe(TOTAL)
  })

  it("place les avis épinglés en tête, c'est ce que la propriétaire vient vérifier", async () => {
    const page1 = await listerAvisPagines(mesAvis(), { page: 1 })

    expect(page1.lignes.slice(0, EPINGLES).every((l) => l.epingle)).toBe(true)
    expect(page1.lignes.slice(EPINGLES).some((l) => l.epingle)).toBe(false)
  })

  it('filtre par statut', async () => {
    const attendu = await prisma.review.count({ where: { productId, statut: 'rejete' } })
    expect(attendu).toBeGreaterThan(0)

    const resultat = await listerAvisPagines(mesAvis(), { page: 1, filtres: { statut: 'rejete' } })

    expect(resultat.total).toBe(attendu)
    expect(resultat.lignes.every((l) => l.statut === 'rejete')).toBe(true)
  })

  it('filtre par épinglage, dans les deux sens', async () => {
    const epingles = await listerAvisPagines(mesAvis(), { page: 1, filtres: { epingle: true } })
    expect(epingles.total).toBe(EPINGLES)
    expect(epingles.lignes.every((l) => l.epingle)).toBe(true)

    // `epingle: false` est le cas qu'un `if (filtres.epingle)` laisserait tomber : la valeur
    // est falsy, mais elle a bien été demandée. D'où le `!== undefined` dans la requête.
    const nonEpingles = await listerAvisPagines(mesAvis(), { page: 1, filtres: { epingle: false } })
    expect(nonEpingles.total).toBe(TOTAL - EPINGLES)
    expect(nonEpingles.lignes.some((l) => l.epingle)).toBe(false)
  })

  it('combine les deux filtres', async () => {
    const attendu = await prisma.review.count({
      where: { productId, statut: 'publie', epingle: false },
    })
    expect(attendu).toBeGreaterThan(0)

    const resultat = await listerAvisPagines(mesAvis(), {
      page: 1,
      filtres: { statut: 'publie', epingle: false },
    })

    expect(resultat.total).toBe(attendu)
    expect(resultat.lignes.every((l) => l.statut === 'publie' && !l.epingle)).toBe(true)
  })

  it('ramène une page demandée hors bornes à la dernière page existante', async () => {
    const resultat = await listerAvisPagines(mesAvis(), { page: 999 })

    expect(resultat.page).toBe(resultat.totalPages)
    expect(resultat.lignes.length).toBeGreaterThan(0)
  })

  it("expose le nom du produit rattaché plutôt que son identifiant technique", async () => {
    const resultat = await listerAvisPagines(mesAvis(), { page: 1 })

    expect(resultat.lignes.every((l) => l.produit === NOM_PRODUIT)).toBe(true)
  })
})
