import { test, expect, type TestInfo } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'

test.use({ storageState: path.join(__dirname, '.auth', 'admin.json') })

const prisma = new PrismaClient()

// Chaque test possède SES données (voir e2e/admin-products.spec.ts, correctif de la tâche
// 11 sur `test.afterAll`, exécuté une fois par worker) : le nom de l'autrice, dérivé du
// titre du test, sert de clé de propriété pour les avis créés comme pour le nettoyage.
function testAuthor(testInfo: TestInfo): string {
  const identity = testInfo.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  // Le rang de répétition est TOUJOURS suffixé, même à la première : la liste est filtrée
  // par sous-chaîne, et « …-attente » serait sinon un préfixe de « …-attente-r1 » — les
  // deux répétitions se verraient l'une l'autre sous `--repeat-each`.
  return `E2E ${identity}-r${testInfo.repeatEachIndex}`
}

async function cleanUp(author: string) {
  const review = await prisma.review.findMany({ where: { author: author }, select: { id: true } })
  const ids = review.map((a) => a.id)
  if (ids.length === 0) return
  await prisma.auditLog.deleteMany({ where: { entity: 'Review', entityId: { in: ids } } })
  await prisma.review.deleteMany({ where: { id: { in: ids } } })
}

test.beforeEach(async ({}, testInfo) => {
  await cleanUp(testAuthor(testInfo))
})

test.afterEach(async ({}, testInfo) => {
  await cleanUp(testAuthor(testInfo))
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('un temoignage importe apparait comme Importe, jamais comme Achat verifie', async ({
  page,
}, testInfo) => {
  const author = testAuthor(testInfo)

  await page.goto('/admin/avis')
  await page.getByLabel('Autrice').fill(author)
  await page.getByLabel('Témoignage').fill('Reçu par WhatsApp, recopié à la main.')
  await page.getByRole('button', { name: 'Importer le témoignage' }).click()

  // Attendre la confirmation de l'action AVANT d'interroger la liste : sans cela, on
  // observerait le rendu d'avant l'écriture, ou pire on quitterait la page en abandonnant
  // la requête en vol.
  await expect(page.getByRole('status')).toHaveText('Témoignage importé.')

  const row = page.getByRole('row').filter({ hasText: author })
  await expect(row).toBeVisible()
  await expect(row.getByText('Importé')).toBeVisible()
  // L'invariant de l'écran : le badge « Achat vérifié » ne s'obtient pas à la main.
  await expect(row.getByText('Achat vérifié')).toHaveCount(0)
})

test('moderer puis epingler un avis en attente', async ({ page }, testInfo) => {
  const author = testAuthor(testInfo)
  const review = await prisma.review.create({
    data: {
      author: author,
      rating: 5,
      body: 'Collier magnifique, je recommande.',
      source: 'verified',
      status: 'pending',
    },
  })

  await page.goto('/admin/avis?statut=pending')
  const row = page.getByRole('row').filter({ hasText: author })
  // Un avis non publié ne propose pas d'épinglage : épinglé sans être en vitrine, il
  // n'apparaîtrait nulle part.
  await expect(row.getByRole('button', { name: /Épingler/ })).toHaveCount(0)

  await row.getByRole('button', { name: 'Publier' }).click()
  // La ligne quitte la liste « En attente » une fois publiée : c'est le signal que
  // l'action est allée au bout. Naviguer avant l'aurait abandonnée en vol.
  await expect(row).toHaveCount(0)

  await page.goto('/admin/avis?statut=published')
  const publishedRow = page.getByRole('row').filter({ hasText: author })
  await publishedRow.getByRole('button', { name: "Épingler à l'accueil" }).click()
  // Le libellé du bouton bascule quand l'épinglage est pris en compte.
  await expect(publishedRow.getByRole('button', { name: "Retirer de l'accueil" })).toBeVisible()

  const after = await prisma.review.findUniqueOrThrow({ where: { id: review.id } })
  expect(after.status).toBe('published')
  expect(after.pinned).toBe(true)
})
