import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { isUniqueViolation } from '@/server/prisma-errors'

function creerErreurP2002(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Violation de contrainte unique', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  })
}

describe('isUniqueViolation', () => {
  it('reconnaît une violation P2002 sur la colonne demandée', () => {
    expect(isUniqueViolation(creerErreurP2002(['sku']), 'sku')).toBe(true)
  })

  it('reconnaît une violation P2002 sur une contrainte composite contenant la colonne demandée', () => {
    expect(isUniqueViolation(creerErreurP2002(['productId', 'libelle']), 'libelle')).toBe(true)
  })

  it('ne confond pas deux contraintes distinctes', () => {
    expect(isUniqueViolation(creerErreurP2002(['sku']), 'libelle')).toBe(false)
  })

  it("ignore une erreur Prisma qui n'est pas P2002", () => {
    const erreur = new Prisma.PrismaClientKnownRequestError('Autre erreur', {
      code: 'P2025',
      clientVersion: 'test',
    })
    expect(isUniqueViolation(erreur, 'sku')).toBe(false)
  })

  it("ignore une erreur qui n'est pas une PrismaClientKnownRequestError", () => {
    expect(isUniqueViolation(new Error('boom'), 'sku')).toBe(false)
  })
})
