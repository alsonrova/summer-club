import { randomBytes } from 'node:crypto'
import { prisma } from './db'
import { resolvePrix } from '@/domain/pricing'
import { calculerTotaux } from '@/domain/cart'
import type { PromotionRule } from '@/domain/types'

export class RuptureStockError extends Error {
  constructor(public readonly variantId: string) {
    super('Stock insuffisant')
    this.name = 'RuptureStockError'
  }
}

function reference(): string {
  return `SC-${randomBytes(4).toString('hex').toUpperCase()}`
}

export async function creerCommande(input: {
  lignes: { variantId: string; quantite: number }[]
  canal: 'orange_money' | 'whatsapp' | 'livraison'
  client: { nom: string; tel: string; email?: string; adresse?: string }
  zoneId: string | null
  estMembre: boolean
}) {
  const statutInitial = input.canal === 'orange_money'
    ? 'en_attente_paiement'
    : input.canal === 'whatsapp'
      ? 'en_attente_confirmation'
      : 'confirmee'

  return prisma.$transaction(async (tx) => {
    // Verrouillage explicite des lignes de variantes, dans un ordre stable
    // pour éviter les interblocages entre transactions concurrentes.
    const ids = [...new Set(input.lignes.map((l) => l.variantId))].sort()
    await tx.$queryRawUnsafe(
      `SELECT id FROM "Variant" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      ids,
    )

    const promotions = (await tx.promotion.findMany({ where: { actif: true } })) as PromotionRule[]
    const maintenant = new Date()

    const lignesCalculees = []
    for (const ligne of input.lignes) {
      const variant = await tx.variant.findUniqueOrThrow({
        where: { id: ligne.variantId }, include: { product: true },
      })
      if (variant.stock < ligne.quantite) throw new RuptureStockError(ligne.variantId)

      const { prixFinal } = resolvePrix({
        prixBase: variant.product.prixBase + variant.deltaPrix,
        productId: variant.productId,
        categoryId: variant.product.categoryId,
        promotions, maintenant, estMembre: input.estMembre,
      })

      lignesCalculees.push({
        variantId: variant.id,
        nomFige: `${variant.product.nom} — ${variant.libelle}`,
        prixUnitaireFige: prixFinal,
        quantite: ligne.quantite,
      })
    }

    const zone = input.zoneId
      ? await tx.deliveryZone.findUnique({ where: { id: input.zoneId } })
      : null

    const totaux = calculerTotaux(
      lignesCalculees.map((l) => ({
        variantId: l.variantId, prixUnitaire: l.prixUnitaireFige, quantite: l.quantite,
      })),
      zone?.tarif ?? null,
    )

    const commande = await tx.order.create({
      data: {
        reference: reference(),
        tokenSuivi: randomBytes(24).toString('base64url'),
        canal: input.canal,
        statut: statutInitial,
        clientNom: input.client.nom,
        tel: input.client.tel,
        email: input.client.email ?? null,
        adresse: input.client.adresse ?? null,
        zoneId: input.zoneId,
        sousTotal: totaux.sousTotal,
        fraisLivraison: totaux.fraisLivraison,
        remise: totaux.remise,
        total: totaux.total,
        items: { create: lignesCalculees },
      },
    })

    // Le stock n'est engagé que si la commande entre directement en confirmee.
    if (statutInitial === 'confirmee') {
      for (const l of lignesCalculees) {
        await tx.variant.update({
          where: { id: l.variantId },
          data: { stock: { decrement: l.quantite } },
        })
      }
    }

    return {
      id: commande.id, reference: commande.reference,
      tokenSuivi: commande.tokenSuivi, total: commande.total,
    }
  }, { isolationLevel: 'Serializable' })
}
