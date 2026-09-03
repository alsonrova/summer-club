import { test, expect, type TestInfo } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'

test.use({ storageState: path.join(__dirname, '.auth', 'admin.json') })

const prisma = new PrismaClient()

// Chaque test possède SES données (voir e2e/admin-products.spec.ts, correctif de la tâche
// 11 sur `test.afterAll`, exécuté une fois par worker) : le nom de l'autrice, dérivé du
// titre du test, sert de clé de propriété pour les avis créés comme pour le nettoyage.
function autricePourTest(testInfo: TestInfo): string {
  const identite = testInfo.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  // Le rang de répétition est TOUJOURS suffixé, même à la première : la liste est filtrée
  // par sous-chaîne, et « …-attente » serait sinon un préfixe de « …-attente-r1 » — les
  // deux répétitions se verraient l'une l'autre sous `--repeat-each`.
  return `E2E ${identite}-r${testInfo.repeatEachIndex}`
}

async function nettoyer(autrice: string) {
  const avis = await prisma.review.findMany({ where: { auteur: autrice }, select: { id: true } })
  const ids = avis.map((a) => a.id)
  if (ids.length === 0) return
  await prisma.auditLog.deleteMany({ where: { entite: 'Review', entiteId: { in: ids } } })
  await prisma.review.deleteMany({ where: { id: { in: ids } } })
}

test.beforeEach(async ({}, testInfo) => {
  await nettoyer(autricePourTest(testInfo))
})

test.afterEach(async ({}, testInfo) => {
  await nettoyer(autricePourTest(testInfo))
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('un temoignage importe apparait comme Importe, jamais comme Achat verifie', async ({
  page,
}, testInfo) => {
  const autrice = autricePourTest(testInfo)

  await page.goto('/admin/avis')
  await page.getByLabel('Autrice').fill(autrice)
  await page.getByLabel('Témoignage').fill('Reçu par WhatsApp, recopié à la main.')
  await page.getByRole('button', { name: 'Importer le témoignage' }).click()

  // Attendre la confirmation de l'action AVANT d'interroger la liste : sans cela, on
  // observerait le rendu d'avant l'écriture, ou pire on quitterait la page en abandonnant
  // la requête en vol.
  await expect(page.getByRole('status')).toHaveText('Témoignage importé.')

  const ligne = page.getByRole('row').filter({ hasText: autrice })
  await expect(ligne).toBeVisible()
  await expect(ligne.getByText('Importé')).toBeVisible()
  // L'invariant de l'écran : le badge « Achat vérifié » ne s'obtient pas à la main.
  await expect(ligne.getByText('Achat vérifié')).toHaveCount(0)
})

test('moderer puis epingler un avis en attente', async ({ page }, testInfo) => {
  const autrice = autricePourTest(testInfo)
  const avis = await prisma.review.create({
    data: {
      auteur: autrice,
      note: 5,
      texte: 'Collier magnifique, je recommande.',
      source: 'verifie',
      statut: 'en_attente',
    },
  })

  await page.goto('/admin/avis?statut=en_attente')
  const ligne = page.getByRole('row').filter({ hasText: autrice })
  // Un avis non publié ne propose pas d'épinglage : épinglé sans être en vitrine, il
  // n'apparaîtrait nulle part.
  await expect(ligne.getByRole('button', { name: /Épingler/ })).toHaveCount(0)

  await ligne.getByRole('button', { name: 'Publier' }).click()
  // La ligne quitte la liste « En attente » une fois publiée : c'est le signal que
  // l'action est allée au bout. Naviguer avant l'aurait abandonnée en vol.
  await expect(ligne).toHaveCount(0)

  await page.goto('/admin/avis?statut=publie')
  const lignePubliee = page.getByRole('row').filter({ hasText: autrice })
  await lignePubliee.getByRole('button', { name: "Épingler à l'accueil" }).click()
  // Le libellé du bouton bascule quand l'épinglage est pris en compte.
  await expect(lignePubliee.getByRole('button', { name: "Retirer de l'accueil" })).toBeVisible()

  const apres = await prisma.review.findUniqueOrThrow({ where: { id: avis.id } })
  expect(apres.statut).toBe('publie')
  expect(apres.epingle).toBe(true)
})
