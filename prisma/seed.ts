import { PrismaClient } from '@prisma/client'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

const prisma = new PrismaClient()

// Instance Better Auth minimale, dédiée au bootstrap du compte administrateur : seul
// `emailAndPassword` est nécessaire pour que le mot de passe soit haché comme en
// production (jamais écrit en clair). Le rôle est ensuite fixé directement via Prisma,
// ce qui évite de dépendre ici du plugin admin ou de la limitation de débit — inutiles
// pour un script serveur qui ne passe pas par les routes HTTP.
const authSeed = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  user: { fields: { name: 'nom' } },
})

async function creerCompteAdmin() {
  const email = process.env.ADMIN_EMAIL
  const motDePasse = process.env.ADMIN_PASSWORD

  if (!email || !motDePasse) {
    console.log(
      "Seed : ADMIN_EMAIL / ADMIN_PASSWORD absents, aucun compte administrateur créé.",
    )
    return
  }

  const existant = await prisma.user.findUnique({ where: { email } })
  if (existant) {
    if (existant.role !== 'admin') {
      await prisma.user.update({ where: { id: existant.id }, data: { role: 'admin' } })
    }
    console.log(`Seed : compte administrateur déjà présent (${email}).`)
    return
  }

  const { user } = await authSeed.api.signUpEmail({
    body: { email, password: motDePasse, name: 'Administrateur' },
  })
  await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } })
  console.log(`Seed : compte administrateur créé (${email}).`)
}

async function main() {
  await creerCompteAdmin()

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
    where: { sku: 'VAH-45' }, update: {},
    create: { productId: produit.id, libelle: '45 cm', sku: 'VAH-45', stock: 5 },
  })
  await prisma.deliveryZone.upsert({
    where: { id: 'zone-tana' }, update: {},
    create: { id: 'zone-tana', nom: 'Antananarivo centre', tarif: 5000, delai: '24 h' },
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
