import { test, expect, type TestInfo } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'

// Réutilise la session administrateur écrite une seule fois par e2e/auth.setup.ts, comme
// e2e/admin-produits.spec.ts : aucun de ces tests ne vérifie le parcours de connexion, et
// s'y reconnecter saturerait le compartiment de limitation de débit partagé de
// /sign-in/email (voir src/server/auth.ts).
test.use({ storageState: path.join(__dirname, '.auth', 'admin.json') })

const prisma = new PrismaClient()

// Chaque test possède SES données, dérivées de son identité (leçon de la tâche 11 :
// `test.afterAll` s'exécute une fois par worker, un nettoyage global détruit les données
// d'un test que ce worker n'a jamais joué). Aucun test ne touche à celles d'un autre.
function cleTest(testInfo: TestInfo): string {
  const identite = testInfo.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  // Rang de répétition toujours suffixé : sans lui, la référence de la première
  // répétition serait un préfixe de celle des suivantes, et le filtre par sous-chaîne de
  // la liste ferait voir à un test les commandes d'un autre sous `--repeat-each`.
  return `E2ECMD-${identite}-R${testInfo.repeatEachIndex}`
}

const slugProduit = (cle: string) => cle.toLowerCase()
// Une catégorie PAR TEST, pas une catégorie partagée : une catégorie commune resterait en
// base après la suite (aucun test ne pouvant la supprimer sans risquer de la retirer sous
// les pieds d'un autre worker), et polluerait le catalogue de la boutique.
const slugCategorie = (cle: string) => `cat-${cle.toLowerCase()}`

async function nettoyer(cle: string) {
  const commandes = await prisma.order.findMany({
    where: { reference: { startsWith: cle } },
    select: { id: true },
  })
  const ids = commandes.map((c) => c.id)
  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entite: 'Order', entiteId: { in: ids } } })
    await prisma.order.deleteMany({ where: { id: { in: ids } } })
  }
  // Le produit part avec sa déclinaison en cascade — mais seulement après les commandes,
  // qui référencent la déclinaison (OrderItem → Variant n'est pas en cascade). Puis la
  // catégorie, qui n'a plus de produit (Product → Category n'est pas en cascade non plus).
  await prisma.product.deleteMany({ where: { slug: slugProduit(cle) } })
  await prisma.category.deleteMany({ where: { slug: slugCategorie(cle) } })
}

/** Crée un produit, une déclinaison et une commande propres au test appelant. */
async function preparerCommande(
  cle: string,
  options: { canal: 'whatsapp' | 'livraison'; statut: 'en_attente_confirmation' | 'annulee'; stock: number; quantite: number },
) {
  const categorie = await prisma.category.upsert({
    where: { slug: slugCategorie(cle) },
    update: {},
    create: { slug: slugCategorie(cle), nom: `Catégorie ${cle}`, ordre: 997 },
  })
  const produit = await prisma.product.create({
    data: {
      slug: slugProduit(cle),
      nom: `Produit ${cle}`,
      description: 'Produit créé uniquement pour un test de bout en bout.',
      categoryId: categorie.id,
      prixBase: 45000,
      variants: { create: { libelle: 'Unique', sku: cle, stock: options.stock } },
    },
    include: { variants: true },
  })
  const variant = produit.variants[0]!

  const commande = await prisma.order.create({
    data: {
      reference: cle,
      tokenSuivi: `token-${cle}`,
      canal: options.canal,
      statut: options.statut,
      clientNom: 'Cliente e2e',
      tel: '0320000000',
      sousTotal: 45000 * options.quantite,
      fraisLivraison: 0,
      total: 45000 * options.quantite,
      items: {
        create: {
          variantId: variant.id,
          nomFige: `Produit ${cle} — Unique`,
          prixUnitaireFige: 45000,
          quantite: options.quantite,
        },
      },
    },
  })

  return { commande, variantId: variant.id }
}

test.beforeEach(async ({}, testInfo) => {
  await nettoyer(cleTest(testInfo))
})

test.afterEach(async ({}, testInfo) => {
  await nettoyer(cleTest(testInfo))
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('la liste retrouve une commande par sa référence et ouvre sa fiche', async ({ page }, testInfo) => {
  const cle = cleTest(testInfo)
  await preparerCommande(cle, {
    canal: 'whatsapp', statut: 'en_attente_confirmation', stock: 5, quantite: 2,
  })

  await page.goto('/admin/commandes')
  await page.getByLabel('Référence').fill(cle)
  await page.getByRole('button', { name: 'Filtrer' }).click()

  await page.getByRole('link', { name: cle }).click()
  await expect(page.getByRole('heading', { name: `Commande ${cle}` })).toBeVisible()
  // Les lignes sont figées à la commande : le nom conservé, pas celui du catalogue courant.
  await expect(page.getByText(`Produit ${cle} — Unique`)).toBeVisible()
})

test('confirmer une commande WhatsApp décrémente le stock', async ({ page }, testInfo) => {
  const cle = cleTest(testInfo)
  const { commande, variantId } = await preparerCommande(cle, {
    canal: 'whatsapp', statut: 'en_attente_confirmation', stock: 5, quantite: 2,
  })

  await page.goto(`/admin/commandes/${commande.id}`)
  // Une commande WhatsApp n'a rien réservé : le stock est encore entier avant l'accord.
  expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(5)

  await page.getByRole('button', { name: 'Confirmer la commande' }).click()

  // L'historique n'affiche cette ligne qu'une fois la transaction validée et la page
  // revalidée : c'est ce qui garantit qu'on relit ensuite un stock déjà écrit.
  await expect(page.getByText('En attente de confirmation → Confirmée')).toBeVisible()
  expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(3)
})

test("une commande annulée n'offre plus aucune transition", async ({ page }, testInfo) => {
  const cle = cleTest(testInfo)
  const { commande } = await preparerCommande(cle, {
    canal: 'livraison', statut: 'annulee', stock: 5, quantite: 1,
  })

  await page.goto(`/admin/commandes/${commande.id}`)
  await expect(page.getByText('Cette commande a atteint un état final')).toBeVisible()
  await expect(page.getByRole('button', { name: /Confirmer|Marquer|Mettre|Annuler/ })).toHaveCount(0)
})
