import { describe, it, expect, afterAll } from 'vitest'
import { rm, stat, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { traiterImage } from '@/server/media'

const LARGEURS_TEST = [400, 800, 1200] as const
const DOSSIER_UPLOADS = path.join(process.cwd(), 'public', 'uploads')

// Chaque test qui produit réellement des fichiers y enregistre le
// `chemin` retourné par traiterImage. Le nom réel des fichiers
// contenant désormais un suffixe aléatoire, le nettoyage ne peut se
// faire qu'à partir de ces chemins retournés — jamais en devinant un
// nom construit à la main.
const cheminsUtilises: string[] = []

function fichierPour(chemin: string, largeur: number, ext: 'avif' | 'webp') {
  return path.join(process.cwd(), 'public', `${chemin}-${largeur}.${ext}`)
}

async function creerSourceJpeg(largeur: number, hauteur: number, fond: string) {
  return sharp({
    create: { width: largeur, height: hauteur, channels: 3, background: fond },
  }).jpeg().toBuffer()
}

afterAll(async () => {
  // Nettoyage à partir des chemins réellement retournés, quelle que
  // soit l'issue des tests (afterAll s'exécute même après un échec).
  const fichiers = cheminsUtilises.flatMap((chemin) =>
    LARGEURS_TEST.flatMap((largeur) => [
      fichierPour(chemin, largeur, 'avif'),
      fichierPour(chemin, largeur, 'webp'),
    ]),
  )
  await Promise.all(fichiers.map((f) => rm(f, { force: true })))

  // Assertion automatisée : aucun résidu dans public/uploads SOUS LES
  // PRÉFIXES que ce fichier de test s'est attribués (`nomBase` +
  // suffixe aléatoire retourné par traiterImage). Deux propriétés :
  // — elle reste plus forte que « les six fichiers nettoyés ci-dessus
  //   ont disparu », qui serait tautologique après un rm : elle
  //   attrape une largeur ou une extension écrite en plus de celles
  //   que ce test connaît ;
  // — elle ne dit rien du reste du dossier. L'assertion précédente
  //   (« il ne reste que .gitkeep ») portait sur un état global que ce
  //   fichier ne possède pas, et échouait par pure coïncidence de
  //   calendrier dès qu'un autre fichier de test y écrivait au même
  //   moment — ce qui avait fait sérialiser toute la suite (voir
  //   vitest.config.ts).
  const prefixes = cheminsUtilises.map((chemin) => `${path.basename(chemin)}-`)
  const entrees = await readdir(DOSSIER_UPLOADS)
  expect(entrees.filter((entree) => prefixes.some((p) => entree.startsWith(p)))).toEqual([])
})

describe('traiterImage', () => {
  it('produit un fichier au ratio 4:5 exact', async () => {
    const source = await creerSourceJpeg(1000, 600, '#EDE5DA')

    const { chemin, largeurs } = await traiterImage(source, 'test-img')
    cheminsUtilises.push(chemin)
    expect(largeurs).toEqual([400, 800, 1200])

    const meta = await sharp(fichierPour(chemin, 400, 'avif')).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(500)
  })

  it('écrit aussi une version webp de repli', async () => {
    const source = await creerSourceJpeg(800, 800, '#EDE5DA')
    const { chemin } = await traiterImage(source, 'test-img')
    cheminsUtilises.push(chemin)
    await expect(stat(fichierPour(chemin, 800, 'webp'))).resolves.toBeTruthy()
  })

  it('produit les trois largeurs au ratio 4:5 exact, en avif comme en webp', async () => {
    const source = await creerSourceJpeg(1000, 600, '#EDE5DA')
    const { chemin, largeurs } = await traiterImage(source, 'dimensions')
    cheminsUtilises.push(chemin)
    expect(largeurs).toEqual([400, 800, 1200])

    for (const largeur of LARGEURS_TEST) {
      const hauteurAttendue = Math.round((largeur * 5) / 4)
      for (const ext of ['avif', 'webp'] as const) {
        const meta = await sharp(fichierPour(chemin, largeur, ext)).metadata()
        expect(meta.width).toBe(largeur)
        expect(meta.height).toBe(hauteurAttendue)
      }
    }
  })

  it("retire l'orientation EXIF d'une photo prise en portrait avant de la recadrer", async () => {
    // Image physiquement plus large que haute, mais marquée orientation
    // 6 (rotation de 90° à appliquer) : c'est le cas d'une photo prise
    // au téléphone en portrait. Sans rotate(), elle serait recadrée de
    // travers.
    const brut = await creerSourceJpeg(1200, 800, '#445566')
    const source = await sharp(brut).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const metaSource = await sharp(source).metadata()
    expect(metaSource.orientation).toBe(6)

    const { chemin } = await traiterImage(source, 'exif-portrait')
    cheminsUtilises.push(chemin)

    const meta = await sharp(fichierPour(chemin, 400, 'avif')).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(500)
    expect(meta.orientation).toBeUndefined()
  })

  it('garantit des chemins distincts et zéro collision entre deux téléversements concurrents du même nomBase', async () => {
    const source1 = await creerSourceJpeg(900, 900, '#111111')
    const source2 = await creerSourceJpeg(900, 900, '#EEEEEE')

    const [resultat1, resultat2] = await Promise.all([
      traiterImage(source1, 'concurrent'),
      traiterImage(source2, 'concurrent'),
    ])
    cheminsUtilises.push(resultat1.chemin, resultat2.chemin)

    expect(resultat1.chemin).not.toBe(resultat2.chemin)

    for (const { chemin } of [resultat1, resultat2]) {
      for (const largeur of LARGEURS_TEST) {
        await expect(stat(fichierPour(chemin, largeur, 'avif'))).resolves.toBeTruthy()
        await expect(stat(fichierPour(chemin, largeur, 'webp'))).resolves.toBeTruthy()
      }
    }
  })

  it('confine une tentative de traversée de chemin à l\'intérieur de public/uploads', async () => {
    const source = await creerSourceJpeg(500, 500, '#000000')
    const nomBaseMalicieux = '../../../../evil'

    // Reproduit le calcul non borné de l'ancien code : c'est
    // l'emplacement, hors de public/uploads, où le fichier aurait été
    // écrit avant correctif.
    const cheminVulnerableAvant = path.join(
      DOSSIER_UPLOADS,
      `${nomBaseMalicieux}-400.avif`,
    )

    const { chemin } = await traiterImage(source, nomBaseMalicieux)
    cheminsUtilises.push(chemin)

    expect(path.basename(chemin).startsWith('evil-')).toBe(true)
    await expect(stat(cheminVulnerableAvant)).rejects.toThrow()
    await expect(stat(fichierPour(chemin, 400, 'avif'))).resolves.toBeTruthy()
  })

  it('rejette un nomBase dont le composant de base contient des caractères interdits', async () => {
    const source = await creerSourceJpeg(400, 400, '#000000')
    await expect(traiterImage(source, '../../../../evil.png')).rejects.toThrow(
      /nomBase invalide/,
    )
  })
})
