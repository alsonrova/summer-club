import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@/server/db'
import { listerCommandesPaginees, COMMANDES_PAR_PAGE } from '@/app/admin/commandes/query'
import { CANAUX, estCanal } from '@/admin/resources/orders'

// Vérifie que la liste des commandes interroge réellement la base (skip/take + comptage)
// plutôt que de charger toutes les commandes en mémoire pour les découper ensuite — le
// piège explicitement signalé pour cette tâche.
//
// Les commandes de ce fichier portent toutes ce préfixe de référence, et c'est par lui
// qu'elles sont sélectionnées ET nettoyées : aucun `deleteMany()` sans filtre, aucun
// comptage global. Les fichiers de test s'exécutent en parallèle (vitest.config.ts).
const PREFIXE = 'PAGCMD-'
const TOTAL = COMMANDES_PAR_PAGE + 5

// Horodatage identique pour toutes les commandes : c'est le cas réel qui casse un tri sur
// `createdAt` seul (une rafale de commandes, un import). Voir le test de stabilité ci-dessous.
const MEME_INSTANT = new Date('2026-08-01T10:00:00.000Z')

async function purger() {
  await prisma.order.deleteMany({ where: { reference: { startsWith: PREFIXE } } })
}

beforeAll(async () => {
  // Défensif : rattrape une exécution précédente interrompue (Ctrl-C, crash du worker).
  await purger()

  for (let i = 0; i < TOTAL; i++) {
    await prisma.order.create({
      data: {
        reference: `${PREFIXE}${String(i).padStart(4, '0')}`,
        tokenSuivi: `token-${PREFIXE}${i}`,
        canal: i % 2 === 0 ? 'whatsapp' : 'livraison',
        statut: i % 3 === 0 ? 'confirmee' : 'en_attente_confirmation',
        clientNom: `Cliente ${i}`,
        tel: '0320000000',
        sousTotal: 45000,
        fraisLivraison: 0,
        total: 45000,
        createdAt: MEME_INSTANT,
      },
    })
  }
})

afterAll(async () => {
  await purger()
  await prisma.$disconnect()
})

// `vitest.config.ts` n'active pas `restoreMocks` : un `mockRestore()` en fin de test ne
// s'exécuterait pas si une assertion échouait avant lui, et l'espion resterait posé sur
// `prisma.order` pour les tests suivants du fichier.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('listerCommandesPaginees', () => {
  it('interroge la base avec skip/take plutôt que de charger toutes les commandes', async () => {
    const espionFindMany = vi.spyOn(prisma.order, 'findMany')
    const espionCount = vi.spyOn(prisma.order, 'count')

    const resultat = await listerCommandesPaginees(prisma.order, {
      page: 1,
      filtres: { reference: PREFIXE },
    })

    expect(espionCount).toHaveBeenCalled()
    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: COMMANDES_PAR_PAGE }),
    )
    expect(resultat.lignes).toHaveLength(COMMANDES_PAR_PAGE)
    expect(resultat.total).toBe(TOTAL)
    expect(resultat.totalPages).toBe(2)
  })

  it("trie sur une clé unique en second critère, sans quoi une même ligne peut sortir sur deux pages", async () => {
    // L'espion est ce qui donne sa valeur protectrice à ce test : les 25 commandes
    // partagent le même `createdAt`, mais PostgreSQL renvoie en pratique un ordre stable
    // tant que rien ne le perturbe — un retour en arrière sur le second critère de tri ne
    // serait donc pas détecté par les seules lignes obtenues.
    const espionFindMany = vi.spyOn(prisma.order, 'findMany')

    const page1 = await listerCommandesPaginees(prisma.order, {
      page: 1, filtres: { reference: PREFIXE },
    })
    const page2 = await listerCommandesPaginees(prisma.order, {
      page: 2, filtres: { reference: PREFIXE },
    })

    expect(espionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    )

    expect(page1.lignes).toHaveLength(COMMANDES_PAR_PAGE)
    expect(page2.lignes).toHaveLength(5)

    const ids = [...page1.lignes.map((l) => l.id), ...page2.lignes.map((l) => l.id)]
    // Ni doublon d'une page à l'autre, ni ligne oubliée.
    expect(new Set(ids).size).toBe(TOTAL)
  })

  it('filtre par statut', async () => {
    const attendu = await prisma.order.count({
      where: { reference: { startsWith: PREFIXE }, statut: 'confirmee' },
    })
    const resultat = await listerCommandesPaginees(prisma.order, {
      page: 1, filtres: { reference: PREFIXE, statut: 'confirmee' },
    })
    expect(resultat.total).toBe(attendu)
    expect(resultat.lignes.every((l) => l.statut === 'confirmee')).toBe(true)
  })

  it('filtre par canal', async () => {
    const resultat = await listerCommandesPaginees(prisma.order, {
      page: 1, filtres: { reference: PREFIXE, canal: 'whatsapp' },
    })
    expect(resultat.lignes.length).toBeGreaterThan(0)
    expect(resultat.lignes.every((l) => l.canal === 'whatsapp')).toBe(true)
  })

  it('retrouve une commande par un fragment de référence, sans respect de la casse', async () => {
    const resultat = await listerCommandesPaginees(prisma.order, {
      page: 1, filtres: { reference: 'pagcmd-0007' },
    })
    expect(resultat.total).toBe(1)
    expect(resultat.lignes[0]?.reference).toBe(`${PREFIXE}0007`)
  })

  it('ramène une page demandée hors bornes à la dernière page existante', async () => {
    const resultat = await listerCommandesPaginees(prisma.order, {
      page: 999, filtres: { reference: PREFIXE },
    })
    expect(resultat.page).toBe(resultat.totalPages)
    expect(resultat.lignes.length).toBeGreaterThan(0)
  })
})

// `estCanal` vit auprès de `CANAUX` (src/admin/resources/orders.ts), comme `estStatut` vit
// auprès de `STATUTS` et `estStatutAvis` auprès de `STATUTS_AVIS` : une seule façon de
// valider une valeur d'énumération venue du client dans ce projet. Il est testé ici parce
// que c'est le filtre de CETTE liste qu'il protège.
describe('estCanal', () => {
  it('accepte les trois canaux déclarés', () => {
    expect(CANAUX.every((c) => estCanal(c))).toBe(true)
  })

  it("refuse une valeur forgée dans la querystring, plutôt que de la transmettre à Prisma", () => {
    expect(estCanal('pigeon_voyageur')).toBe(false)
    expect(estCanal('')).toBe(false)
  })

  it("refuse ce qui n'est pas une chaîne — un paramètre d'URL peut être absent ou répété", () => {
    expect(estCanal(undefined)).toBe(false)
    expect(estCanal(null)).toBe(false)
    expect(estCanal(['whatsapp'])).toBe(false)
  })
})
