import { describe, it, expect } from 'vitest'
import { validerFichierMedia, TYPES_IMAGE_ACCEPTES, TAILLE_MAX_MEDIA_OCTETS } from '@/server/media'

// Validation pure (aucune écriture disque, aucune session) : c'est ce qui permet à
// televerserMedia() de refuser un fichier avant même d'appeler traiterImage(), et à ce
// test de vérifier ce refus sans passer par une Server Action ni une base de données.
describe('validerFichierMedia', () => {
  it('accepte un JPEG de taille raisonnable', () => {
    expect(validerFichierMedia({ type: 'image/jpeg', size: 1024 })).toBeNull()
  })

  it.each(TYPES_IMAGE_ACCEPTES)('accepte %s', (type) => {
    expect(validerFichierMedia({ type, size: 1024 })).toBeNull()
  })

  it('refuse un type de fichier non autorisé (ex. PDF)', () => {
    const erreur = validerFichierMedia({ type: 'application/pdf', size: 1024 })
    expect(erreur).toMatch(/Format non accepté/)
  })

  it('refuse une image dépassant la taille maximale', () => {
    const erreur = validerFichierMedia({
      type: 'image/png',
      size: TAILLE_MAX_MEDIA_OCTETS + 1,
    })
    expect(erreur).toMatch(/trop lourde/)
  })

  it('accepte une image exactement à la taille maximale', () => {
    expect(
      validerFichierMedia({ type: 'image/png', size: TAILLE_MAX_MEDIA_OCTETS }),
    ).toBeNull()
  })

  it("refuse l'absence de fichier (type et taille vides)", () => {
    const erreur = validerFichierMedia({ type: '', size: 0 })
    expect(erreur).toMatch(/Aucun fichier/)
  })
})
