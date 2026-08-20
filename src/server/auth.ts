import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from './db'

// Le modèle Prisma `User` a été aligné sur ce qu'attend Better Auth (voir le commentaire
// dans prisma/schema.prisma). Le champ `name` de Better Auth est mappé sur la colonne
// métier `nom` pour ne pas dupliquer/renommer un champ déjà utilisé ailleurs.
//
// Le plugin `admin` gère le rôle comme une simple chaîne : on le configure avec les deux
// seules valeurs de l'énumération Prisma `Role` (`admin` / `membre`) plutôt que ses valeurs
// par défaut (`admin` / `user`).
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  user: {
    fields: { name: 'nom' },
  },
  plugins: [
    admin({ defaultRole: 'membre', adminRoles: ['admin'] }),
    // Doit rester le dernier plugin : il relaie les cookies de session posés par les
    // autres endpoints vers l'API `cookies()` de Next.js (utile pour les Server Actions).
    nextCookies(),
  ],
  rateLimit: { enabled: true, window: 60, max: 10 },
})

/**
 * Exige une session administrateur pour accéder à la page appelante. Redirige vers
 * l'écran de connexion si la session est absente ou si l'utilisateur n'a pas le rôle
 * `admin` (ex. un futur compte membre).
 */
export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/admin/connexion')
  return session
}
