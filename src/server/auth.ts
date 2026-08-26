import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { cache } from 'react'
import { prisma } from './db'

// Better Auth ne fait qu'avertir (log) si aucun secret valide n'est trouvé : en dehors de
// la production, il retombe silencieusement sur un secret par défaut connu de tous. C'est
// exactement le scénario d'un déploiement qui copierait .env.example tel quel. On refuse
// donc de démarrer, plutôt que de compter sur cet avertissement.
//
// Trois variables sont acceptées, comme par Better Auth lui-même (voir
// node_modules/better-auth/dist/context/create-context.mjs et
// node_modules/better-auth/dist/context/secret-utils.mjs) : `BETTER_AUTH_SECRET` (cas
// courant), `AUTH_SECRET` (alias), et `BETTER_AUTH_SECRETS` pour la rotation de clés
// (format "version:secret,version:secret", la première entrée étant la clé courante — les
// suivantes ne servent qu'à vérifier d'anciens cookies encore valides). On retient
// explicitement le secret validé pour le transmettre à betterAuth({ secret }) plutôt que
// de laisser la bibliothèque le relire seule depuis l'environnement.
function secretCourantDeLaRotation(env: string | undefined): string | undefined {
  if (!env) return undefined
  const premiereEntree = env.split(',')[0]?.trim() ?? ''
  const idxDeuxPoints = premiereEntree.indexOf(':')
  if (idxDeuxPoints === -1) return undefined
  return premiereEntree.slice(idxDeuxPoints + 1).trim() || undefined
}

const secret =
  secretCourantDeLaRotation(process.env.BETTER_AUTH_SECRETS) ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET

if (!secret || secret.length < 32) {
  throw new Error(
    'Aucun secret valide (BETTER_AUTH_SECRET, AUTH_SECRET ou BETTER_AUTH_SECRETS) ' +
      "n'a été trouvé, ou il fait moins de 32 caractères. Générez-en un avec " +
      "`openssl rand -base64 32` (ou `node -e \"console.log(require('crypto')." +
      'randomBytes(32).toString(\'base64\'))"`) et placez-le dans `.env`.',
  )
}

// Le modèle Prisma `User` a été aligné sur ce qu'attend Better Auth (voir le commentaire
// dans prisma/schema.prisma). Le champ `name` de Better Auth est mappé sur la colonne
// métier `nom` pour ne pas dupliquer/renommer un champ déjà utilisé ailleurs.
//
// Le plugin `admin` gère le rôle comme une simple chaîne : on le configure avec les deux
// seules valeurs de l'énumération Prisma `Role` (`admin` / `membre`) plutôt que ses valeurs
// par défaut (`admin` / `user`).
export const auth = betterAuth({
  secret,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    // Le brief interdit l'inscription publique : sans ce champ, POST /api/auth/sign-up/email
    // reste joignable sans session par n'importe qui.
    disableSignUp: true,
  },
  user: {
    fields: { name: 'nom' },
  },
  plugins: [
    admin({ defaultRole: 'membre', adminRoles: ['admin'] }),
    // Doit rester le dernier plugin : il relaie les cookies de session posés par les
    // autres endpoints vers l'API `cookies()` de Next.js (utile pour les Server Actions).
    nextCookies(),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
    customRules: {
      // La règle spéciale par défaut de Better Auth sur /sign-in* (3 tentatives / 10 s)
      // autorise environ mille essais par heure : très large pour une boutique à un ou
      // deux administrateurs. On la resserre spécifiquement pour la connexion — mais la
      // fenêtre reste courte (une minute) et n'est PAS allongée davantage, pour une raison
      // précise : sans `advanced.ipAddress` configuré, `getIP()` (voir
      // node_modules/@better-auth/core/dist/utils/ip.mjs, utilisé par
      // node_modules/better-auth/dist/api/rate-limiter/index.mjs) ne lit que l'en-tête
      // `x-forwarded-for`, absent en local et en production tant qu'aucun proxy de
      // confiance ne le pose. La clé de compteur retombe alors sur `no-trusted-ip|<route>`
      // : un seul seau partagé par TOUS les visiteurs, pas un compteur par adresse IP.
      // N'importe quel visiteur anonyme peut donc épuiser les dix tentatives et verrouiller
      // la connexion pour tout le monde, administratrice comprise. Une fenêtre d'une minute
      // garde cette indisponibilité brève ; l'allonger transformerait la protection contre
      // le bruteforce en outil de déni de service contre l'administratrice elle-même.
      // Cette fenêtre pourra être élargie le jour où `advanced.ipAddress` sera configuré en
      // cohérence avec le reverse proxy de production (Caddy est prévu ; il pose bien
      // `x-forwarded-for`) — tâche de déploiement, pas de ce correctif.
      '/sign-in/email': { window: 60, max: 10 },
    },
  },
})

/**
 * Convention d'administration : le layout de /admin appelle requireAdmin(), mais un
 * layout ne protège ni les Server Actions, ni les Route Handlers, ni le reste de la route
 * en cas de rendu partiel (voir node_modules/next/dist/docs/01-app/02-guides/
 * authentication.md, section « Layouts and auth checks »). Un fichier
 * src/app/admin/**\/route.ts n'exécute d'ailleurs jamais de layout : c'est le cas le plus
 * dangereux, car un cookie de session périmé ou forgé qui franchit Proxy (vérification
 * seulement optimiste, voir src/proxy.ts) atteindrait le handler sans aucun contrôle réel
 * si celui-ci omettait cet appel. TOUTE page, TOUTE Server Action et TOUT Route Handler
 * d'administration doit donc appeler requireAdmin() lui-même, au plus près de sa source de
 * données — le layout ne suffit pas. `getSessionAdmin` est enveloppée dans `cache()` pour
 * que plusieurs appels au cours d'un même rendu (layout + page, par exemple) ne
 * déclenchent qu'une seule vérification de session.
 */
const getSessionAdmin = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

/**
 * Exige une session administrateur pour accéder à la page ou à l'action appelante.
 * Distingue deux échecs : pas de session -> redirection vers la connexion ; session valide
 * mais rôle différent de `admin` -> redirection vers la page « accès réservé » (pas la
 * connexion, pour ne pas produire de va-et-vient sans fin pour un utilisateur déjà connecté).
 */
export async function requireAdmin() {
  const session = await getSessionAdmin()
  if (!session) redirect('/connexion')
  if (session.user.role !== 'admin') redirect('/acces-refuse')
  return session
}
