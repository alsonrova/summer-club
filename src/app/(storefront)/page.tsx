import type { Metadata } from 'next'
import { listProducts } from '@/server/products'
import { listPinnedReviews } from '@/server/reviews'
import { Hero } from '@/components/home/hero'
import { About } from '@/components/home/about'
import { Selection } from '@/components/home/selection'
import { Reviews } from '@/components/home/reviews'
import { CallToAction } from '@/components/home/call-to-action'

// La page d'accueil vit dans le groupe (storefront), et non à la racine de src/app/ :
// c'est ce groupe qui pose l'en-tête et le pied de page (layout.tsx → StorefrontShell).
// À la racine, elle aurait été la seule page publique sans navigation — c'est ce qu'était
// le gabarit de create-next-app qu'elle remplace, et ce que le lien de marque de l'en-tête
// atteignait depuis la tâche 13 (arbitrage du coordinateur, clôture de la tâche 14 : « le
// lien de marque vers / atterrit sur la page gabarit […] remplacé par la tâche 15 »).
//
// Rendu statique revalidé toutes les cinq minutes (spec § 4.3), et à la demande : les
// actions produit et les changements de statut de commande invalident `/` en suivant
// productPathsToRevalidate (src/server/products.ts), les actions d'avis le font elles-mêmes
// (revalidateReviewPaths, src/app/admin/avis/actions.ts). Sans cela, un produit retiré ou
// un avis dépunaisé resterait en vitrine jusqu'à cinq minutes.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Summer Club — Bijoux solaires en acier inoxydable',
  description:
    "Bijoux en acier inoxydable plaqué or 18k, pensés pour la mer, la douche et les journées entières. Livraison à Antananarivo.",
}

// Nombre de pièces mises en avant sur l'accueil (spec § 8.3 : « 6 à 8 produits »). La
// sélection est aujourd'hui la tête du catalogue, dans l'ordre d'affichage choisi au
// back-office : c'est ce levier-là que la propriétaire a déjà en main pour décider ce qui
// paraît ici. Une colonne « mis en avant » dédiée serait un changement de schéma, hors du
// périmètre de cette tâche.
const SELECTION_SIZE = 8

export default async function HomePage() {
  const [products, reviews] = await Promise.all([listProducts(), listPinnedReviews()])

  return (
    <main>
      {/* Repli sans JavaScript : Reveal masque ses conteneurs jusqu'à leur entrée dans le
          champ, et cet effet ne s'exécute pas si le script ne tourne pas — la page
          n'aurait plus que son hero. Cette règle n'est appliquée par le navigateur que
          dans ce cas précis, et elle est ici plutôt que dans Reveal pour n'être écrite
          qu'une fois, quel que soit le nombre d'apparitions de la page. */}
      <noscript>
        <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
      </noscript>

      <Hero />
      <About />
      <Selection products={products.slice(0, SELECTION_SIZE)} />
      <Reviews reviews={reviews} />
      {/* Le numéro WhatsApp est lu ici, côté serveur, et jamais exposé autrement que dans
          le lien rendu : pas de variable NEXT_PUBLIC_*, qui l'inscrirait dans le paquet
          JavaScript de toutes les pages. Absent ou mal formé, aucun lien n'est rendu
          (voir CallToAction). */}
      <CallToAction whatsappNumber={process.env.WHATSAPP_NUMBER} />
    </main>
  )
}
