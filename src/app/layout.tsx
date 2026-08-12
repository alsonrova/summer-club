import { Fraunces, Instrument_Sans } from 'next/font/google'
import './globals.css'

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
