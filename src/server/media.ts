import sharp from 'sharp'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const LARGEURS = [400, 800, 1200] as const
const DOSSIER = path.join(process.cwd(), 'public', 'uploads')

// Types MIME acceptés pour un téléversement de photo produit, et taille maximale avant
// même de tenter le décodage par sharp. Exportés pour rester la source unique de vérité
// entre le contrôle (validerFichierMedia, ci-dessous) et ses tests — dupliquer ces valeurs
// dans televerserMedia() les ferait diverger silencieusement d'ici.
export const TYPES_IMAGE_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export const TAILLE_MAX_MEDIA_OCTETS = 8 * 1024 * 1024

// Validation pure, sans effet de bord : ni écriture disque, ni session, ni base de
// données. Elle doit s'exécuter AVANT traiterImage() dans televerserMedia(), pour qu'un
// fichier refusé (mauvais format, trop lourd, absent) ne déclenche jamais mkdir/sharp sur
// un fichier qui sera de toute façon rejeté. Retourne le message d'erreur en français à
// afficher, ou null si le fichier est acceptable.
export function validerFichierMedia(fichier: { type: string; size: number }): string | null {
  if (fichier.size === 0) {
    return 'Aucun fichier sélectionné.'
  }
  if (!(TYPES_IMAGE_ACCEPTES as readonly string[]).includes(fichier.type)) {
    return 'Format non accepté. Utilisez JPEG, PNG, WebP ou AVIF.'
  }
  if (fichier.size > TAILLE_MAX_MEDIA_OCTETS) {
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
export class ErreurImageIllisible extends Error {
  constructor(cause: unknown) {
    super("Le contenu du fichier n'est pas une image décodable.", { cause })
    this.name = 'ErreurImageIllisible'
  }
}

// Encodage seul, sans aucune écriture : c'est le seul endroit où un échec est imputable au
// CONTENU du fichier. `sharp().toFile()` mêlait au contraire décodage, encodage et écriture
// dans un même appel qui lève une `Error` nue dans les trois cas — impossible alors de
// distinguer, chez l'appelant, un fichier illisible d'un disque plein.
async function encoderVariante(buffer: Buffer, largeur: number, hauteur: number) {
  try {
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
    return {
      avif: await base.clone().avif({ quality: 62 }).toBuffer(),
      webp: await base.clone().webp({ quality: 78 }).toBuffer(),
    }
  } catch (cause) {
    throw new ErreurImageIllisible(cause)
  }
}

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
    const { avif, webp } = await encoderVariante(buffer, largeur, hauteur)

    // L'écriture est séparée de l'encodage : ce qui échoue ici (ENOSPC, EACCES, EROFS…)
    // vient du système de fichiers, pas du fichier envoyé, et remonte tel quel — jamais
    // déguisé en « image illisible ».
    await writeFile(path.join(DOSSIER, `${nomFichier}-${largeur}.avif`), avif)
    await writeFile(path.join(DOSSIER, `${nomFichier}-${largeur}.webp`), webp)
  }

  return { chemin: `/uploads/${nomFichier}`, largeurs: [...LARGEURS] }
}

// Contrepartie de traiterImage() : efface du disque les six fichiers (trois largeurs, deux
// formats) qu'elle a produits pour un `chemin` donné (la valeur stockée dans Media.chemin,
// ex. `/uploads/xyz-abcdef12`). `force: true` (via rm) rend l'appel idempotent — un fichier
// déjà absent ne fait pas échouer la suppression de la ligne Media qui le référençait.
export async function effacerFichiersMedia(chemin: string): Promise<void> {
  const racinePublic = path.join(process.cwd(), 'public')
  const fichiers = LARGEURS.flatMap((largeur) =>
    (['avif', 'webp'] as const).map((extension) =>
      path.join(racinePublic, `${chemin}-${largeur}.${extension}`),
    ),
  )
  await Promise.all(fichiers.map((fichier) => rm(fichier, { force: true })))
}
