import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { prisma } from '@/server/db'
import { listPinnedReviews } from '@/server/reviews'

// Lignes propres à ce fichier : l'autrice porte son préfixe, le nettoyage ne balaie que
// lui (§ 6.3 des conventions — chaque fichier possède ses lignes et n'assère que sur
// elles). Les avis ne sont rattachés à aucun produit : `Review.productId` est optionnel
// (prisma/schema.prisma), et un témoignage importé d'Instagram n'en a pas.
const AUTHOR_PREFIX = 'reviews-test-'

function author(name: string): string {
  return `${AUTHOR_PREFIX}${name}`
}

async function cleanUp() {
  await prisma.review.deleteMany({ where: { author: { startsWith: AUTHOR_PREFIX } } })
}

beforeAll(async () => {
  await cleanUp()
  await prisma.review.createMany({
    data: [
      { author: author('mialy'), rating: 5, body: 'Épinglé, publié, premier.', source: 'verified', status: 'published', pinned: true, position: 1 },
      { author: author('hanta'), rating: 4, body: 'Épinglé, publié, deuxième.', source: 'imported', status: 'published', pinned: true, position: 2 },
      { author: author('tahina'), rating: 5, body: 'Épinglé, publié, troisième.', source: 'verified', status: 'published', pinned: true, position: 3 },
      { author: author('vola'), rating: 5, body: 'Épinglé, publié, quatrième.', source: 'verified', status: 'published', pinned: true, position: 4 },
      { author: author('noro'), rating: 5, body: 'Publié mais non épinglé.', source: 'verified', status: 'published', pinned: false, position: 0 },
      { author: author('fara'), rating: 1, body: 'Épinglé mais en attente de modération.', source: 'imported', status: 'pending', pinned: true, position: 0 },
      { author: author('lala'), rating: 1, body: 'Épinglé mais rejeté.', source: 'imported', status: 'rejected', pinned: true, position: 0 },
    ],
  })
})

afterAll(async () => {
  await cleanUp()
  await prisma.$disconnect()
})

describe('listPinnedReviews', () => {
  it('ne retient que les avis épinglés ET publiés', async () => {
    const reviews = await listPinnedReviews()
    const authors = reviews.map((review) => review.author)
    // Un avis en attente ou rejeté n'a jamais été validé par la propriétaire : épinglé par
    // erreur, il ne doit pas atteindre la page d'accueil. Symétriquement, un avis publié
    // mais non épinglé n'a pas été choisi pour la vitrine.
    expect(authors).not.toContain(author('fara'))
    expect(authors).not.toContain(author('lala'))
    expect(authors).not.toContain(author('noro'))
  })

  it('rend les trois premiers dans l’ordre choisi au back-office', async () => {
    // Spec § 8.4 : trois avis épinglés. `position` est la colonne que l'écran avis fait
    // glisser ; sans tri explicite, l'ordre dépendrait du plan d'exécution PostgreSQL.
    const reviews = await listPinnedReviews()
    expect(reviews.map((review) => review.author)).toEqual([
      author('mialy'), author('hanta'), author('tahina'),
    ])
  })

  it('ne publie que ce que la page affiche', async () => {
    // Projection explicite : ni `orderId`, ni `productId`, ni `createdAt` ne traversent
    // vers un composant. Même parti pris que StorefrontProduct (tâche 14) — ce qui n'est
    // pas projeté ne peut pas fuiter.
    const reviews = await listPinnedReviews()
    expect(Object.keys(reviews[0] ?? {}).sort()).toEqual(['author', 'body', 'id', 'rating', 'source'])
  })
})
