import { describe, it, expect, afterAll } from 'vitest'
import { rm, stat } from 'node:fs/promises'
import sharp from 'sharp'
import { traiterImage } from '@/server/media'

const FICHIERS_PRODUITS = [400, 800, 1200].flatMap((largeur) => [
  `public/uploads/test-img-${largeur}.avif`,
  `public/uploads/test-img-${largeur}.webp`,
])

afterAll(async () => {
  await Promise.all(FICHIERS_PRODUITS.map((f) => rm(f, { force: true })))
})

describe('traiterImage', () => {
  it('produit un fichier au ratio 4:5 exact', async () => {
    const source = await sharp({
      create: { width: 1000, height: 600, channels: 3, background: '#EDE5DA' },
    }).jpeg().toBuffer()

    const { largeurs } = await traiterImage(source, 'test-img')
    expect(largeurs).toEqual([400, 800, 1200])

    const meta = await sharp('public/uploads/test-img-400.avif').metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(500)
  })

  it('écrit aussi une version webp de repli', async () => {
    const source = await sharp({
      create: { width: 800, height: 800, channels: 3, background: '#EDE5DA' },
    }).jpeg().toBuffer()
    await traiterImage(source, 'test-img')
    await expect(stat('public/uploads/test-img-800.webp')).resolves.toBeTruthy()
  })
})
