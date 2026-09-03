import { PrismaClient } from '@prisma/client'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

// Instance Better Auth minimale dédiée aux tests e2e, séparée de src/server/auth.ts :
// l'instance de production a `emailAndPassword.disableSignUp: true` (Correctif 1), donc
// créer un compte de test (rôle `member`, par défaut) doit passer par sa propre instance —
// exactement comme prisma/seed.ts le fait déjà pour le compte administrateur.
const prisma = new PrismaClient()
const authTest = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
})

/** Crée un compte de rôle `member` (le rôle par défaut) et renvoie son id. */
export async function createMemberAccount(email: string, password: string) {
  const { user } = await authTest.api.signUpEmail({
    body: { email, password, name: 'Membre de test' },
  })
  return user.id
}

/** Supprime le compte de test (cascade Prisma sur ses sessions/comptes liés). */
export async function deleteAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } })
}

export async function closeTestConnection() {
  await prisma.$disconnect()
}
