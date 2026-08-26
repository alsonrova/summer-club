import { requireAdmin } from '@/server/auth'
import { prisma } from '@/server/db'
import { creerProduit } from '../actions'
import { etatFormulaireProduitInitial } from '../etats'
import { FormulaireProduit } from '../formulaire-produit'

// Segment statique /admin/produits/nouveau : Next.js le fait toujours correspondre en
// priorité sur la route dynamique voisine /admin/produits/[id], donc "nouveau" n'est jamais
// interprété comme un identifiant de produit.
export default async function NouveauProduitPage() {
  await requireAdmin()

  const categories = await prisma.category.findMany({
    orderBy: { ordre: 'asc' },
    select: { id: true, nom: true },
  })

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-light text-bark">Nouveau produit</h1>
      <FormulaireProduit
        action={creerProduit}
        etatInitial={etatFormulaireProduitInitial}
        categories={categories}
        libelleSoumettre="Enregistrer"
      />
    </div>
  )
}
