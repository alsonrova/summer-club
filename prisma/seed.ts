import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const cat = await prisma.category.upsert({
    where: { slug: 'colliers' }, update: {},
    create: { slug: 'colliers', nom: 'Colliers', ordre: 1 },
  })
  const produit = await prisma.product.upsert({
    where: { slug: 'collier-vahine' }, update: {},
    create: {
      slug: 'collier-vahine', nom: 'Collier Vahiné',
      description: 'Acier inoxydable plaqué or 18k, chaîne fine.',
      categoryId: cat.id, prixBase: 45000, prixAchat: 18000,
    },
  })
  await prisma.variant.upsert({
    where: { sku: 'VAH-45' }, update: { stock: 5 },
    create: { productId: produit.id, libelle: '45 cm', sku: 'VAH-45', stock: 5 },
  })
  await prisma.deliveryZone.upsert({
    where: { id: 'zone-tana' }, update: {},
    create: { id: 'zone-tana', nom: 'Antananarivo centre', tarif: 5000, delai: '24 h' },
  })
}

main().finally(() => prisma.$disconnect())
