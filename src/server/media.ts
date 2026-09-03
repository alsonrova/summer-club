import sharp from 'sharp'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const WIDTHS = [400, 800, 1200] as const
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

// Types MIME acceptés pour un téléversement de photo produit, et taille maximale avant
// même de tenter le décodage par sharp. Exportés pour rester la source unique de vérité
// entre le contrôle (validateMediaFile, ci-dessous) et ses tests — dupliquer ces valeurs
// dans televerserMedia() les ferait diverger silencieusement d'ici.
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024

// Validation pure, sans effet de bord : ni écriture disque, ni session, ni base de
// données. Elle doit s'exécuter AVANT processImage() dans televerserMedia(), pour qu'un
// fichier refusé (mauvais format, trop lourd, absent) ne déclenche jamais mkdir/sharp sur
// un fichier qui sera de toute façon rejeté. Retourne le message d'erreur en français à
// afficher, ou null si le fichier est acceptable.
export function validateMediaFile(file: { type: string; size: number }): string | null {
  if (file.size === 0) {
    return 'Aucun fichier sélectionné.'
  }
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Format non accepté. Utilisez JPEG, PNG, WebP ou AVIF.'
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return 'Image trop lourde. Maximum 8 Mo.'
  }
  return null
}

// Erreur dédiée au seul cas « le contenu envoyé n'est pas une image décodable » : type MIME
// usurpé (un PDF renommé en .jpg), fichier tronqué, format que libvips ne sait pas lire.
// Elle existe pour que televerserMedia puisse distinguer ce cas — le seul auquel le message
// « cette image n'a pas pu être lue » s'applique — d'une panne d'écriture (disque plein,
// droits refusés sur public/uploads), qui n'est pas la faute du fichier envoyé et ne doit
// pas être imputée à la propriétaire. `cause` conserve l'erreur sharp d'origine pour la
// journalisation côté serveur.
export class UnreadableImageError extends Error {
  constructor(cause: unknown) {
    super("Le contenu du fichier n'est pas une image décodable.", { cause })
    this.name = 'UnreadableImageError'
  }
}

// Encodage seul, sans aucune écriture : c'est le seul endroit où un échec est imputable au
// CONTENU du fichier. `sharp().toFile()` mêlait au contraire décodage, encodage et écriture
// dans un même appel qui lève une `Error` nue dans les trois cas — impossible alors de
// distinguer, chez l'appelant, un fichier illisible d'un disque plein.
async function encodeVariant(buffer: Buffer, width: number, height: number) {
  try {
    // Le ré-encodage systématique neutralise tout contenu piégé
    // dissimulé dans le fichier d'origine.
    // Pas de .normalise() : cette opération étire le contraste par
    // image prise isolément, ce qui rend hétérogènes des photos prises
    // dans les mêmes conditions et risque de brûler les reflets
    // spéculaires du métal et des pierres — contre-productif pour un
    // catalogue dont l'homogénéité fait la qualité perçue.
    const base = sharp(buffer).rotate().resize(width, height, {
      fit: 'cover', position: 'attention',
    })
    return {
      avif: await base.clone().avif({ quality: 62 }).toBuffer(),
      webp: await base.clone().webp({ quality: 78 }).toBuffer(),
    }
  } catch (cause) {
    throw new UnreadableImageError(cause)
  }
}

export async function processImage(buffer: Buffer, baseName: string) {
  // `processImage` est la défense du pipeline : elle n'accorde aucune
  // confiance à son appelant. On réduit `baseName` à son composant de
  // base puis on rejette tout ce qui ne ressemble pas à un identifiant
  // simple, pour empêcher toute traversée de chemin (`../`, chemins
  // absolus, etc.) hors de public/uploads.
  const sanitizedName = path.basename(baseName)
  if (!/^[A-Za-z0-9_-]+$/.test(sanitizedName)) {
    throw new Error(
      `baseName invalide : « ${baseName} » doit être composé uniquement de lettres, chiffres, tirets et underscores.`,
    )
  }

  await mkdir(UPLOAD_DIR, { recursive: true })

  // Le nom réellement utilisé sur disque est décidé ici, pas par
  // l'appelant : baseName (l'id produit) est le même pour tous les
  // téléversements d'un même produit, donc déterministe — sans suffixe,
  // deux téléversements successifs du même produit produiraient
  // systématiquement le même nom de base, concurrence ou pas. Les
  // writeFile ci-dessous écrasent sans prévenir : sans ce suffixe, le
  // second téléversement corromprait les fichiers du premier, déjà
  // référencés par une ligne Media.
  const suffix = randomBytes(8).toString('hex')
  const fileName = `${sanitizedName}-${suffix}`

  for (const width of WIDTHS) {
    const height = Math.round((width * 5) / 4)
    const { avif, webp } = await encodeVariant(buffer, width, height)

    // L'écriture est séparée de l'encodage : ce qui échoue ici (ENOSPC, EACCES, EROFS…)
    // vient du système de fichiers, pas du fichier envoyé, et remonte tel quel — jamais
    // déguisé en « image illisible ».
    await writeFile(path.join(UPLOAD_DIR, `${fileName}-${width}.avif`), avif)
    await writeFile(path.join(UPLOAD_DIR, `${fileName}-${width}.webp`), webp)
  }

  return { chemin: `/uploads/${fileName}`, widths: [...WIDTHS] }
}

// Contrepartie de processImage() : efface du disque les six fichiers (trois largeurs, deux
// formats) qu'elle a produits pour un `chemin` donné (la valeur stockée dans Media.chemin,
// ex. `/uploads/xyz-abcdef12`). `force: true` (via rm) rend l'appel idempotent — un fichier
// déjà absent ne fait pas échouer la suppression de la ligne Media qui le référençait.
export async function deleteMediaFiles(mediaPath: string): Promise<void> {
  const publicRoot = path.join(process.cwd(), 'public')
  const files = WIDTHS.flatMap((width) =>
    (['avif', 'webp'] as const).map((extension) =>
      path.join(publicRoot, `${mediaPath}-${width}.${extension}`),
    ),
  )
  await Promise.all(files.map((file) => rm(file, { force: true })))
}
