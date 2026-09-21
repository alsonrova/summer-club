import { Reveal } from '@/components/ui/reveal'

// Récit court de la marque (spec § 8.2). La spec borne la section à « deux à trois
// arguments, pas davantage » : c'est ce que tient ARGUMENTS, et ce que garde
// tests/components/home-sections.test.tsx. Un quatrième dilue les trois autres.
const ARGUMENTS = [
  {
    title: 'Acier inoxydable',
    body: "Le métal ne noircit pas, ne verdit pas la peau et ne se déforme pas. C'est ce qui permet de ne plus y penser.",
  },
  {
    title: 'Plaqué or 18k',
    body: "La couleur chaude de l'or sur une base qui dure, à un prix qui reste celui d'un bijou qu'on porte tous les jours.",
  },
  {
    title: "Résistant à l'eau",
    body: 'La mer, la douche, la transpiration, une journée entière sous le soleil de Tana : rien de tout cela ne se retire.',
  },
]

export function About() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
      <Reveal>
        <h2 className="text-h2">Notre histoire</h2>
        <p className="mt-6 max-w-[68ch] leading-[1.7] text-bark-soft">
          Summer Club est née à Antananarivo d&apos;une idée simple : un bijou qu&apos;on
          enlève chaque soir finit dans un tiroir. Nous cherchions des pièces qui suivent une
          journée entière — la mer, la douche, le travail — sans rien demander.
        </p>
      </Reveal>
      <ul className="mt-14 grid gap-8 md:grid-cols-3">
        {ARGUMENTS.map((argument, index) => (
          <li key={argument.title}>
            <Reveal delay={index * 70}>
              <h3 className="font-display text-h3 font-normal">{argument.title}</h3>
              <p className="mt-3 leading-[1.7] text-bark-soft">{argument.body}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
