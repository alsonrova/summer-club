import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const LARGEURS = [400, 800, 1200] as const
const DOSSIER = path.join(process.cwd(), 'public', 'uploads')

export async function traiterImage(buffer: Buffer, nomBase: string) {
  // `traiterImage` est la défense du pipeline : elle n'accorde aucune
  // confiance à son appelant. On réduit `nomBase` à son composant de
  // base puis on rejette tout ce qui ne ressemble pas à un identifiant
  // simple, pour empêcher toute traversée de chemin (`../`, chemins
  // absolus, etc.) hors de public/uploads.
  const nomAssaini = path.basename(nomBase)
  if (!/^[A-Za-z0-9_-]+$/.test(nomAssaini)) {
    throw new Error(
      `nomBase invalide : « ${nomBase} » doit être composé uniquement de lettres, chiffres, tirets et underscores.`,
    )
  }

  await mkdir(DOSSIER, { recursive: true })

  // Le nom réellement utilisé sur disque est décidé ici, pas par
  // l'appelant : un suffixe aléatoire garantit l'unicité même si deux
  // téléversements concurrents partagent le même nomBase, ce que
  // sharp().toFile() n'écrit pas de façon atomique.
  const suffixe = randomBytes(8).toString('hex')
  const nomFichier = `${nomAssaini}-${suffixe}`

  for (const largeur of LARGEURS) {
    const hauteur = Math.round((largeur * 5) / 4)
    // Le ré-encodage systématique neutralise tout contenu piégé
    // dissimulé dans le fichier d'origine.
    // Pas de .normalise() : cette opération étire le contraste par
    // image prise isolément, ce qui rend hétérogènes des photos prises
    // dans les mêmes conditions et risque de brûler les reflets
    // spéculaires du métal et des pierres — contre-productif pour un
    // catalogue dont l'homogénéité fait la qualité perçue.
    const base = sharp(buffer).rotate().resize(largeur, hauteur, {
      fit: 'cover', position: 'attention',
    })

    await base.clone().avif({ quality: 62 }).toFile(
      path.join(DOSSIER, `${nomFichier}-${largeur}.avif`))
    await base.clone().webp({ quality: 78 }).toFile(
      path.join(DOSSIER, `${nomFichier}-${largeur}.webp`))
  }

  return { chemin: `/uploads/${nomFichier}`, largeurs: [...LARGEURS] }
}
