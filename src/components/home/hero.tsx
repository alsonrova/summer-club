import Image from 'next/image'
import Link from 'next/link'

// Hero de la page d'accueil (spec § 8.1) : sur-titre, titre en Fraunces 300, argument
// court, appel à l'action vers la boutique, et la photo portée à droite.
//
// C'est la SEULE image `priority` du site : elle porte le LCP de la page d'accueil, dont
// le budget est fixé à 2,5 s en 3G rapide (spec § 11). Toute autre image du site se charge
// paresseusement — ajouter un second `priority` ici les mettrait en concurrence.
//
// public/hero-1200.avif est aujourd'hui un aplat de `--clay` aux dimensions finales
// (1200×1500, ratio 4:5), pas une photographie : le dépôt n'en contient aucune, et la
// prise de vue est une dépendance externe (public/guide-photo.md, spec § 3.9). Tant que
// c'est un aplat, l'image est décorative — `alt=""` : un texte alternatif qui décrirait un
// mannequin décrirait quelque chose qui n'est pas à l'écran, et le lecteur d'écran
// l'annoncerait comme une information. **Quand la vraie photo remplacera ce fichier, le
// texte alternatif doit arriver avec elle** (« Mannequin portant un collier fin en acier
// plaqué or, lumière naturelle »), et `aria-hidden` disparaître.
export function Hero() {
  return (
    <section className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-6 py-24 md:grid-cols-[1.1fr_1fr] md:px-10 md:py-40">
      <div>
        <p className="text-eyebrow uppercase tracking-[.16em] text-bark-soft">Nouvelle saison</p>
        <h1 className="mt-5 text-hero font-light leading-[.98] tracking-[-.02em]">
          Le bijou
          <br />
          que vous
          <br />
          <span className="font-medium text-sage-deep">oubliez</span>
        </h1>
        <p className="mt-6 max-w-[38ch] leading-[1.7] text-bark-soft">
          Acier inoxydable plaqué or 18k. Assez léger pour dormir avec, assez solide pour
          l&apos;été entier.
        </p>
        <Link
          href="/boutique"
          className="mt-9 inline-block rounded-full bg-sage-deep px-7 py-3.5 text-eyebrow font-medium uppercase tracking-[.1em] text-shell transition-colors duration-[180ms] hover:bg-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-2"
        >
          La boutique
        </Link>
      </div>

      <div
        className="relative aspect-[4/5] overflow-hidden bg-clay"
        style={{ borderRadius: 'var(--radius-arch)' }}
      >
        <Image
          src="/hero-1200.avif"
          alt=""
          aria-hidden
          fill
          priority
          sizes="(max-width: 768px) 100vw, 45vw"
          className="object-cover"
        />
      </div>
    </section>
  )
}
