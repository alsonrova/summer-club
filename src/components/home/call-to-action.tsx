import Link from 'next/link'
import { Reveal } from '@/components/ui/reveal'

// Forme acceptée pour le numéro WhatsApp : des chiffres au format international, sans
// `+` ni espace ni indicatif local — c'est ce que wa.me attend dans son chemin.
// Liste blanche qui REFUSE au lieu de réparer (docs/CONVENTIONS.md § 4, règle 5) : un
// « 032 46 182 90 » ou un « +261 32 … » lu depuis l'environnement produirait sinon une URL
// wa.me silencieusement fausse, qui ouvrirait une conversation avec personne.
//
// La normalisation d'un numéro malgache vers cette forme appartient à `whatsappLink`
// (plan, tâche 18 « Tunnel de commande et canal WhatsApp »), qui en aura besoin pour le
// message pré-rempli. Ce composant la consommera alors au lieu de ce garde.
const WHATSAPP_NUMBER_PATTERN = /^\d{8,15}$/

// Bandeau final (spec § 8.5) : retour vers la boutique, Instagram, WhatsApp.
//
// Le compte Instagram est connu (spec § 1, `@summerclub.mg`). **Le numéro WhatsApp
// Business ne l'est pas** : la spec le range parmi les dépendances externes (§ 12), il
// n'est écrit nulle part dans ce dépôt, et un numéro ne s'invente pas — celui d'une
// inconnue recevrait les commandes. Il arrive donc par l'environnement
// (`WHATSAPP_NUMBER`, voir .env.example), et tant qu'il est absent ou mal formé, le lien
// n'est pas rendu du tout : un lien mort est un défaut, pas une promesse — même
// raisonnement que le lien « Panier » retiré de l'en-tête jusqu'à la tâche 16.
//
// Les deux liens externes restent dans le même onglet, à dessein : ouvrir une fenêtre sans
// le dire est un défaut d'accessibilité, et l'annoncer dans le libellé alourdirait un
// bandeau qui tient en trois mots.
export function CallToAction({ whatsappNumber }: { whatsappNumber?: string }) {
  const whatsappLink = whatsappNumber && WHATSAPP_NUMBER_PATTERN.test(whatsappNumber)
    ? `https://wa.me/${whatsappNumber}`
    : null

  return (
    <section
      aria-label="Rejoindre Summer Club"
      className="bg-clay"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
        <Reveal>
          <h2 className="text-h2">Une pièce vous attend</h2>
          <p className="mt-6 max-w-[68ch] leading-[1.7] text-bark-soft">
            Livraison à Antananarivo et environs. Écrivez-nous, on répond vite.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              href="/boutique"
              className="inline-block rounded-full bg-sage-deep px-7 py-3.5 text-eyebrow font-medium uppercase tracking-[.1em] text-shell transition-colors duration-[180ms] hover:bg-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
            >
              La boutique
            </Link>
            <a
              href="https://www.instagram.com/summerclub.mg"
              className="text-bark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
            >
              Instagram
            </a>
            {whatsappLink && (
              <a
                href={whatsappLink}
                className="text-bark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
              >
                WhatsApp
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
