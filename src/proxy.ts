import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

// Défense en profondeur complémentaire au layout (src/app/admin/layout.tsx) et à
// requireAdmin() (src/server/auth.ts) : Proxy s'exécute AVANT la résolution de route,
// donc avant même que Next.js décide qu'une route sans page.tsx correspondante doit
// renvoyer un 404 générique — ce que le layout, lui, ne voit jamais (un layout ne
// s'exécute que pour une route effectivement résolue). Sans cette étape, une route
// plausible mais non créée comme /admin/produits renverrait un 404 muet plutôt qu'une
// redirection vers /connexion, avant même qu'un écran existe pour la protéger.
//
// Vérification volontairement « optimiste » : seule la présence du cookie de session est
// contrôlée (pas sa validité, pas le rôle), comme recommandé dans la doc Next.js livrée
// (node_modules/next/dist/docs/01-app/02-guides/authentication.md, section « Optimistic
// checks with Proxy ») pour éviter un accès base de données sur chaque requête, y compris
// les requêtes préchargées. La vérification réelle (session + rôle admin) reste faite par
// requireAdmin(), appelé par le layout ET par chaque page/Server Action d'administration.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/connexion', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
