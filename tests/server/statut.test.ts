import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { prisma } from '@/server/db'
import { creerCommande, RuptureStockError } from '@/server/orders'
import { appliquerStatut, TransitionInterditeError } from '@/server/order-status-service'

// Les tests visent appliquerStatut : changerStatut n'en est que
// l'enveloppe authentifiée, et requireAdmin n'a pas de sens hors requête.
const changerStatut = (id: string, vers: Parameters<typeof appliquerStatut>[1]) =>
  appliquerStatut(id, vers, 'test')

let variantId: string

// Jeu de données PROPRE à ce fichier, et non la déclinaison de seed « VAH-45 ».
//
// Le brief proposait de réutiliser VAH-45 et de vider les tables Order/OrderItem
// entières entre chaque test. Mesuré : ce fichier et tests/server/orders.test.ts
// s'exécutent en parallèle (vitest.config.ts, fileParallelism laissé au défaut) et se
// disputaient alors exactement les mêmes lignes. Trois exécutions de la suite complète
// ont donné 4, 4 puis 2 échecs, répartis dans LES DEUX fichiers et jamais les mêmes :
// « expected 6 to be 3 » (le stock de VAH-45 remis à 10 par un fichier au milieu du test
// de l'autre), « expected 8 to be 10 » (la commande annulée ici supprimée par le
// `order.deleteMany()` global de l'autre fichier avant sa relecture), « promise resolved
// instead of rejecting » (stock remonté sous les pieds du test de rupture).
//
// Ce n'est pas une intermittence de la base ni du code testé : c'est un partage de
// données mutables entre deux fichiers dont aucun ne les possède — la même faute que la
// tâche 11 avait corrigée pour public/uploads et pour les produits e2e. La réponse est
// donc la même : chaque fichier possède ses propres lignes et ne supprime que les
// siennes. Ni sérialisation des fichiers, ni plafond de workers, ni réessai.
//
// Les trois tests du brief (describe « changerStatut » ci-dessous) sont repris mot pour
// mot ; seule cette fixture partagée a changé.
const SLUG_CATEGORIE = 'test-statuts-categorie'
const SLUG_PRODUIT = 'test-statuts-produit'
const SKU = 'STATUT-45'

const client = { nom: 'T', tel: '0320000000' }

/** Toutes les commandes de ce fichier — et elles seules — portent cette déclinaison. */
function mesCommandes() {
  return { items: { some: { variantId } } }
}

async function purgerMesCommandes() {
  const miennes = await prisma.order.findMany({ where: mesCommandes(), select: { id: true } })
  const ids = miennes.map((o) => o.id)
  if (ids.length === 0) return
  // Bornée à mes propres identifiants : le journal d'audit est une table globale que ce
  // fichier ne possède pas, on n'y touche que les lignes qu'on y a écrites.
  await prisma.auditLog.deleteMany({ where: { entite: 'Order', entiteId: { in: ids } } })
  await prisma.order.deleteMany({ where: { id: { in: ids } } })
}

// Idempotent : la suite repart d'une base laissée dans n'importe quel état par une
// exécution interrompue (Ctrl-C, crash du worker), sans intervention manuelle.
beforeAll(async () => {
  const categorie = await prisma.category.upsert({
    where: { slug: SLUG_CATEGORIE },
    update: {},
    create: { slug: SLUG_CATEGORIE, nom: 'Catégorie de test (statuts)', ordre: 999 },
  })
  const produit = await prisma.product.upsert({
    where: { slug: SLUG_PRODUIT },
    update: { actif: true, prixBase: 45000, categoryId: categorie.id },
    create: {
      slug: SLUG_PRODUIT,
      nom: 'Produit de test (statuts)',
      description: 'Jeu de données réservé à tests/server/statut.test.ts.',
      categoryId: categorie.id,
      prixBase: 45000,
      prixAchat: 18000,
    },
  })
  await prisma.variant.upsert({
    where: { sku: SKU },
    update: { stock: 10, deltaPrix: 0, productId: produit.id },
    create: { productId: produit.id, libelle: '45 cm', sku: SKU, stock: 10 },
  })
})

beforeEach(async () => {
  const v = await prisma.variant.findUniqueOrThrow({ where: { sku: SKU } })
  variantId = v.id
  await purgerMesCommandes()
  await prisma.variant.update({ where: { id: v.id }, data: { stock: 10 } })
})

afterEach(purgerMesCommandes)

afterAll(async () => {
  await purgerMesCommandes()
  // Le produit est supprimé avec sa déclinaison en cascade (schema.prisma) : le catalogue
  // de la boutique ne garde aucune trace de ce jeu de données une fois la suite terminée.
  await prisma.product.deleteMany({ where: { slug: SLUG_PRODUIT } })
  await prisma.category.deleteMany({ where: { slug: SLUG_CATEGORIE } })
  await prisma.$disconnect()
})

describe('changerStatut', () => {
  it('recrédite le stock à l\'annulation d\'une commande confirmée', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 3 }], canal: 'livraison',
      client: { nom: 'T', tel: '0320000000' }, zoneId: null, estMembre: false,
    })
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(7)

    await changerStatut(c.id, 'annulee')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })

  it('refuse une transition interdite', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 1 }], canal: 'livraison',
      client: { nom: 'T', tel: '0320000000' }, zoneId: null, estMembre: false,
    })
    await changerStatut(c.id, 'annulee')
    await expect(changerStatut(c.id, 'expediee')).rejects.toThrow(/transition/i)
  })

  it('ne recrédite pas deux fois si l\'annulation est rejouée', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 2 }], canal: 'livraison',
      client: { nom: 'T', tel: '0320000000' }, zoneId: null, estMembre: false,
    })
    await changerStatut(c.id, 'annulee')
    await changerStatut(c.id, 'annulee').catch(() => {})
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })
})

describe('appliquerStatut — transitions interdites', () => {
  it('lève TransitionInterditeError (famille CommandeError) avec un message français, sans toucher au stock', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 2 }], canal: 'livraison', client,
      zoneId: null, estMembre: false,
    })
    // confirmee → livree n'est pas une transition déclarée : il faut passer par
    // en_preparation, puis expediee ou prete_retrait.
    await expect(changerStatut(c.id, 'livree')).rejects.toBeInstanceOf(TransitionInterditeError)
    await expect(changerStatut(c.id, 'livree')).rejects.toThrow(
      'Transition interdite : confirmee → livree',
    )
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(8)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).statut).toBe('confirmee')
  })
})

describe('appliquerStatut — confirmation d\'une commande WhatsApp', () => {
  it('décrémente le stock à la confirmation, puisque rien n\'était réservé à la création', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 2 }], canal: 'whatsapp', client,
      zoneId: null, estMembre: false,
    })
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)

    await changerStatut(c.id, 'confirmee')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(8)
  })

  it('lève RuptureStockError quand le stock est parti entre-temps, sans laisser la contrainte CHECK de la base rattraper le coup', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 3 }], canal: 'whatsapp', client,
      zoneId: null, estMembre: false,
    })
    // Le stock part ailleurs entre la prise de commande WhatsApp et son acceptation :
    // c'est le scénario métier réel, une commande WhatsApp ne réserve rien.
    await prisma.variant.update({ where: { id: variantId }, data: { stock: 1 } })

    await expect(changerStatut(c.id, 'confirmee')).rejects.toBeInstanceOf(RuptureStockError)

    // Le contrôle métier doit avoir refusé AVANT toute écriture : ni stock négatif rattrapé
    // par la contrainte `variant_stock_non_negatif`, ni statut avancé à tort.
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(1)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.id } })).statut).toBe(
      'en_attente_confirmation',
    )
  })

  it('ne décrémente qu\'une fois si la confirmation est rejouée', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 4 }], canal: 'whatsapp', client,
      zoneId: null, estMembre: false,
    })
    await changerStatut(c.id, 'confirmee')
    await changerStatut(c.id, 'confirmee').catch(() => {})
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(6)
  })
})

describe('appliquerStatut — stock déjà engagé', () => {
  it('ne décrémente pas une seconde fois à la confirmation d\'un paiement Orange Money', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 2 }], canal: 'orange_money', client,
      zoneId: null, estMembre: false,
    })
    // en_attente_paiement appartient à STOCK_ENGAGE : la réservation a eu lieu à la création.
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(8)

    await changerStatut(c.id, 'confirmee')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(8)
  })

  it('recrédite un paiement échoué puis annulé exactement une fois', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 3 }], canal: 'orange_money', client,
      zoneId: null, estMembre: false,
    })
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(7)

    // en_attente_paiement → echec_paiement sort de STOCK_ENGAGE : le stock revient.
    await changerStatut(c.id, 'echec_paiement')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)

    // echec_paiement → annulee : les deux sont hors de STOCK_ENGAGE, rien ne bouge.
    await changerStatut(c.id, 'annulee')
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })
})

describe('appliquerStatut — accès concurrent sur la même commande', () => {
  it('n\'applique qu\'un seul des deux changements de statut simultanés', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 3 }], canal: 'livraison', client,
      zoneId: null, estMembre: false,
    })
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(7)

    const resultats = await Promise.allSettled([
      changerStatut(c.id, 'annulee'),
      changerStatut(c.id, 'annulee'),
    ])

    expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const echouees = resultats.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    )
    expect(echouees).toHaveLength(1)
    // La perdante doit être arrêtée par la machine à états après avoir RELU le statut réel,
    // pas par un conflit de sérialisation opaque (P2034 / 40001) qui n'aurait jamais atteint
    // ce contrôle : c'est cette assertion qui empêche la régression du correctif
    // d'isolation (Serializable + FOR UPDATE, cf. src/server/order-status-service.ts).
    expect(echouees[0]!.reason).toBeInstanceOf(TransitionInterditeError)

    // Un seul recrédit, donc le stock initial — pas 13.
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })

  it('sert deux annulations concurrentes de commandes DIFFÉRENTES sans en rejeter une à tort', async () => {
    const [a, b] = await Promise.all([
      creerCommande({
        lignes: [{ variantId, quantite: 2 }], canal: 'livraison', client,
        zoneId: null, estMembre: false,
      }),
      creerCommande({
        lignes: [{ variantId, quantite: 3 }], canal: 'livraison', client,
        zoneId: null, estMembre: false,
      }),
    ])
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(5)

    const resultats = await Promise.allSettled([
      changerStatut(a.id, 'annulee'),
      changerStatut(b.id, 'annulee'),
    ])
    expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(2)
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10)
  })
})

describe('appliquerStatut — journal d\'audit', () => {
  it('journalise l\'acteur, l\'ancien et le nouveau statut', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 1 }], canal: 'whatsapp', client,
      zoneId: null, estMembre: false,
    })
    await appliquerStatut(c.id, 'confirmee', 'proprietaire@summerclub.mg')

    // Assertion bornée à MA commande : le journal d'audit est une table globale que ce
    // fichier ne possède pas.
    const traces = await prisma.auditLog.findMany({
      where: { entite: 'Order', entiteId: c.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(traces).toHaveLength(1)
    expect(traces[0]!.acteur).toBe('proprietaire@summerclub.mg')
    expect(traces[0]!.action).toBe('changement_statut')
    expect(traces[0]!.avant).toEqual({ statut: 'en_attente_confirmation' })
    expect(traces[0]!.apres).toEqual({ statut: 'confirmee' })
  })

  it('n\'écrit aucune trace quand la transition est refusée', async () => {
    const c = await creerCommande({
      lignes: [{ variantId, quantite: 1 }], canal: 'livraison', client,
      zoneId: null, estMembre: false,
    })
    await changerStatut(c.id, 'livree').catch(() => {})
    expect(
      await prisma.auditLog.count({ where: { entite: 'Order', entiteId: c.id } }),
    ).toBe(0)
  })
})
