import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { estViolationUnicite } from '@/server/prisma-erreurs'

function creerErreurP2002(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Violation de contrainte unique', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  })
}

describe('estViolationUnicite', () => {
  it('reconnaît une violation P2002 sur la colonne demandée', () => {
    expect(estViolationUnicite(creerErreurP2002(['sku']), 'sku')).toBe(true)
  })

  it('reconnaît une violation P2002 sur une contrainte composite contenant la colonne demandée', () => {
    expect(estViolationUnicite(creerErreurP2002(['productId', 'libelle']), 'libelle')).toBe(true)
  })

  it('ne confond pas deux contraintes distinctes', () => {
    expect(estViolationUnicite(creerErreurP2002(['sku']), 'libelle')).toBe(false)
  })

  it("ignore une erreur Prisma qui n'est pas P2002", () => {
    const erreur = new Prisma.PrismaClientKnownRequestError('Autre erreur', {
      code: 'P2025',
      clientVersion: 'test',
    })
    expect(estViolationUnicite(erreur, 'sku')).toBe(false)
  })

  it("ignore une erreur qui n'est pas une PrismaClientKnownRequestError", () => {
    expect(estViolationUnicite(new Error('boom'), 'sku')).toBe(false)
  })
})
