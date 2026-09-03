import { describe, it, expect } from 'vitest'
import { validateMediaFile, ACCEPTED_IMAGE_TYPES, MAX_MEDIA_BYTES } from '@/server/media'

// Validation pure (aucune écriture disque, aucune session) : c'est ce qui permet à
// televerserMedia() de refuser un fichier avant même d'appeler processImage(), et à ce
// test de vérifier ce refus sans passer par une Server Action ni une base de données.
describe('validateMediaFile', () => {
  it('accepte un JPEG de taille raisonnable', () => {
    expect(validateMediaFile({ type: 'image/jpeg', size: 1024 })).toBeNull()
  })

  it.each(ACCEPTED_IMAGE_TYPES)('accepte %s', (type) => {
    expect(validateMediaFile({ type, size: 1024 })).toBeNull()
  })

  it('refuse un type de fichier non autorisé (ex. PDF)', () => {
    const erreur = validateMediaFile({ type: 'application/pdf', size: 1024 })
    expect(erreur).toMatch(/Format non accepté/)
  })

  it('refuse une image dépassant la taille maximale', () => {
    const erreur = validateMediaFile({
      type: 'image/png',
      size: MAX_MEDIA_BYTES + 1,
    })
    expect(erreur).toMatch(/trop lourde/)
  })

  it('accepte une image exactement à la taille maximale', () => {
    expect(
      validateMediaFile({ type: 'image/png', size: MAX_MEDIA_BYTES }),
    ).toBeNull()
  })

  it("refuse l'absence de fichier (type et taille vides)", () => {
    const erreur = validateMediaFile({ type: '', size: 0 })
    expect(erreur).toMatch(/Aucun fichier/)
  })
})
