import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const LARGEURS = [400, 800, 1200] as const
const DOSSIER = path.join(process.cwd(), 'public', 'uploads')

export async function traiterImage(buffer: Buffer, nomBase: string) {
  await mkdir(DOSSIER, { recursive: true })

  for (const largeur of LARGEURS) {
    const hauteur = Math.round((largeur * 5) / 4)
    // Le ré-encodage systématique neutralise tout contenu piégé
    // dissimulé dans le fichier d'origine.
    const base = sharp(buffer).rotate().resize(largeur, hauteur, {
      fit: 'cover', position: 'attention',
    }).normalise()

    await base.clone().avif({ quality: 62 }).toFile(
      path.join(DOSSIER, `${nomBase}-${largeur}.avif`))
    await base.clone().webp({ quality: 78 }).toFile(
      path.join(DOSSIER, `${nomBase}-${largeur}.webp`))
  }

  return { chemin: `/uploads/${nomBase}`, largeurs: [...LARGEURS] }
}
