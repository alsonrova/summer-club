import { describe, it, expect, afterAll } from 'vitest'
import { rm, stat, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { processImage } from '@/server/media'

const TEST_WIDTHS = [400, 800, 1200] as const
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

// Chaque test qui produit réellement des fichiers y enregistre le
// `chemin` retourné par processImage. Le nom réel des fichiers
// contenant désormais un suffixe aléatoire, le nettoyage ne peut se
// faire qu'à partir de ces chemins retournés — jamais en devinant un
// nom construit à la main.
const usedPaths: string[] = []

function fileFor(mediaPath: string, width: number, ext: 'avif' | 'webp') {
  return path.join(process.cwd(), 'public', `${mediaPath}-${width}.${ext}`)
}

async function createJpegSource(width: number, height: number, background: string) {
  return sharp({
    create: { width: width, height: height, channels: 3, background },
  }).jpeg().toBuffer()
}

afterAll(async () => {
  // Nettoyage à partir des chemins réellement retournés, quelle que
  // soit l'issue des tests (afterAll s'exécute même après un échec).
  const files = usedPaths.flatMap((mediaPath) =>
    TEST_WIDTHS.flatMap((width) => [
      fileFor(mediaPath, width, 'avif'),
      fileFor(mediaPath, width, 'webp'),
    ]),
  )
  await Promise.all(files.map((f) => rm(f, { force: true })))

  // Assertion automatisée : aucun résidu dans public/uploads SOUS LES
  // PRÉFIXES que ce fichier de test s'est attribués (`baseName` +
  // suffixe aléatoire retourné par processImage). Deux propriétés :
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
  const prefixes = usedPaths.map((mediaPath) => `${path.basename(mediaPath)}-`)
  const entries = await readdir(UPLOAD_DIR)
  expect(entries.filter((entry) => prefixes.some((p) => entry.startsWith(p)))).toEqual([])
})

describe('processImage', () => {
  it('produit un fichier au ratio 4:5 exact', async () => {
    const source = await createJpegSource(1000, 600, '#EDE5DA')

    const { path: mediaPath, widths } = await processImage(source, 'test-img')
    usedPaths.push(mediaPath)
    expect(widths).toEqual([400, 800, 1200])

    const meta = await sharp(fileFor(mediaPath, 400, 'avif')).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(500)
  })

  it('écrit aussi une version webp de repli', async () => {
    const source = await createJpegSource(800, 800, '#EDE5DA')
    const { path: mediaPath } = await processImage(source, 'test-img')
    usedPaths.push(mediaPath)
    await expect(stat(fileFor(mediaPath, 800, 'webp'))).resolves.toBeTruthy()
  })

  it('produit les trois largeurs au ratio 4:5 exact, en avif comme en webp', async () => {
    const source = await createJpegSource(1000, 600, '#EDE5DA')
    const { path: mediaPath, widths } = await processImage(source, 'dimensions')
    usedPaths.push(mediaPath)
    expect(widths).toEqual([400, 800, 1200])

    for (const width of TEST_WIDTHS) {
      const expectedHeight = Math.round((width * 5) / 4)
      for (const ext of ['avif', 'webp'] as const) {
        const meta = await sharp(fileFor(mediaPath, width, ext)).metadata()
        expect(meta.width).toBe(width)
        expect(meta.height).toBe(expectedHeight)
      }
    }
  })

  it("retire l'orientation EXIF d'une photo prise en portrait avant de la recadrer", async () => {
    // Image physiquement plus large que haute, mais marquée orientation
    // 6 (rotation de 90° à appliquer) : c'est le cas d'une photo prise
    // au téléphone en portrait. Sans rotate(), elle serait recadrée de
    // travers.
    const raw = await createJpegSource(1200, 800, '#445566')
    const source = await sharp(raw).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const sourceMeta = await sharp(source).metadata()
    expect(sourceMeta.orientation).toBe(6)

    const { path: mediaPath } = await processImage(source, 'exif-portrait')
    usedPaths.push(mediaPath)

    const meta = await sharp(fileFor(mediaPath, 400, 'avif')).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(500)
    expect(meta.orientation).toBeUndefined()
  })

  it('garantit des chemins distincts et zéro collision entre deux téléversements concurrents du même baseName', async () => {
    const source1 = await createJpegSource(900, 900, '#111111')
    const source2 = await createJpegSource(900, 900, '#EEEEEE')

    const [first, second] = await Promise.all([
      processImage(source1, 'concurrent'),
      processImage(source2, 'concurrent'),
    ])
    usedPaths.push(first.path, second.path)

    expect(first.path).not.toBe(second.path)

    for (const { path: mediaPath } of [first, second]) {
      for (const width of TEST_WIDTHS) {
        await expect(stat(fileFor(mediaPath, width, 'avif'))).resolves.toBeTruthy()
        await expect(stat(fileFor(mediaPath, width, 'webp'))).resolves.toBeTruthy()
      }
    }
  })

  it('confine une tentative de traversée de chemin à l\'intérieur de public/uploads', async () => {
    const source = await createJpegSource(500, 500, '#000000')
    const maliciousBaseName = '../../../../evil'

    // Reproduit le calcul non borné de l'ancien code : c'est
    // l'emplacement, hors de public/uploads, où le fichier aurait été
    // écrit avant correctif.
    const vulnerablePathBefore = path.join(
      UPLOAD_DIR,
      `${maliciousBaseName}-400.avif`,
    )

    const { path: mediaPath } = await processImage(source, maliciousBaseName)
    usedPaths.push(mediaPath)

    expect(path.basename(mediaPath).startsWith('evil-')).toBe(true)
    await expect(stat(vulnerablePathBefore)).rejects.toThrow()
    await expect(stat(fileFor(mediaPath, 400, 'avif'))).resolves.toBeTruthy()
  })

  it('rejette un baseName dont le composant de base contient des caractères interdits', async () => {
    const source = await createJpegSource(400, 400, '#000000')
    await expect(processImage(source, '../../../../evil.png')).rejects.toThrow(
      /baseName invalide/,
    )
  })
})
