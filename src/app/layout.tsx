import type { Metadata } from 'next'
import { Fraunces, Instrument_Sans } from 'next/font/google'
import './globals.css'

// Titre d'onglet par défaut de tout écran qui n'en pose pas lui-même — la page 404 racine
// (src/app/not-found.tsx) en premier lieu, qui ne peut pas exporter de metadata : sans ce
// défaut, son onglet restait sans titre (constat du testeur UX/UI, tâche 14 : il affichait
// « 404: This page could not be found. »). Une page qui exporte son propre `title` (la
// boutique, une fiche) le remplace tel quel.
export const metadata: Metadata = { title: 'Summer Club' }

const display = Fraunces({
  subsets: ['latin'], display: 'swap', variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'], weight: 'variable',
})
const body = Instrument_Sans({
  subsets: ['latin'], display: 'swap', variable: '--font-instrument',
  weight: ['400', '500'],
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
