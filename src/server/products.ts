import { prisma } from '@/server/db'
import { deleteMediaFiles } from '@/server/media'

// Fonction propriétaire de la suppression d'un produit. La cascade Prisma (Media, Variant)
// n'atteint que les lignes en base : les fichiers écrits par processImage dans
// public/uploads — un dossier servi publiquement — ne sont référencés par rien d'autre que
// Media.path, et un `product.delete` brut les abandonne sur disque, accessibles à qui
// connaît leur URL (dette constatée le 2026-08-30 : six fichiers orphelins). L'effacement
// disque appartient donc à cette fonction, pas à chaque appelant — même raisonnement que la
// liste blanche de processImage (docs/CONVENTIONS.md § 4, règle 5) : un futur appelant qui
// supprime un produit n'a aucune raison de connaître cette obligation, et c'est le seul
// endroit qu'il ne peut pas oublier.
//
// Comme applyStatus (src/server/order-status-service.ts), cette fonction est le cœur
// sans authentification ni invalidation de cache : une future Server Action de suppression
// appellera requireAdmin(), déléguera ici, puis auditera et revalidera elle-même.
export async function deleteProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, media: { select: { path: true } } },
  })
  // Tolère l'absence : deux passes de nettoyage (avant/après un test, double clic demain)
  // peuvent se croiser, et la seconde ne doit pas lever.
  if (!product) return

  // Fichiers d'abord, lignes ensuite — même ordre et même raisonnement que deleteMedia
  // (src/app/admin/produits/actions.ts) : si l'effacement disque échoue, mieux vaut un
  // produit intact aux photos cassées (visible, corrigible) que des fichiers orphelins
  // qu'aucune fiche ne référence plus jamais. deleteMediaFiles est idempotente
  // (rm force), un nouvel appel après échec partiel reprend sans broncher.
  await Promise.all(product.media.map((media) => deleteMediaFiles(media.path)))

  // deleteMany plutôt que delete : findUnique puis delete n'est pas atomique, et une
  // suppression concurrente entre les deux ne doit pas transformer « déjà supprimé » en
  // erreur P2025 (même choix que cleanUpTestProduct, e2e/admin-products.spec.ts).
  await prisma.product.deleteMany({ where: { id: product.id } })
}
