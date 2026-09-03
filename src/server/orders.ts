import { randomBytes } from 'node:crypto'
import { prisma } from './db'
import { resolvePrice } from '@/domain/pricing'
import { computeTotals } from '@/domain/cart'
import { STOCK_COMMITTED } from '@/domain/order-status'
import type { PromotionRule } from '@/domain/types'

/** Classe de base de toutes les erreurs métier levées par ce module. */
export class OrderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class OutOfStockError extends OrderError {
  constructor(public readonly variantId: string) {
    super('Stock insuffisant')
  }
}

export class EmptyCartError extends OrderError {
  constructor() {
    super('Le panier est vide')
  }
}

export class InvalidQuantityError extends OrderError {
  constructor(public readonly variantId: string) {
    super('La quantité demandée pour cet article est invalide')
  }
}

export class VariantNotFoundError extends OrderError {
  constructor(public readonly variantId: string) {
    super("Cet article n'existe pas ou n'est plus disponible")
  }
}

export class ProductUnavailableError extends OrderError {
  constructor(public readonly productId: string) {
    super("Ce produit n'est plus en vente")
  }
}

export class InvalidZoneError extends OrderError {
  constructor(public readonly zoneId: string) {
    super("La zone de livraison sélectionnée n'est pas valide")
  }
}

/** Quantité maximale par déclinaison, alignée sur la borne du panier côté client. */
const MAX_QUANTITY = 20

function reference(): string {
  return `SC-${randomBytes(6).toString('hex').toUpperCase()}`
}

export type OrderInput = {
  lines: { variantId: string; quantity: number }[]
  channel: 'orange_money' | 'whatsapp' | 'livraison'
  client: { customerName: string; phone: string; email?: string; address?: string }
  zoneId: string | null
  isMember: boolean
}

export type CreatedOrder = {
  id: string
  reference: string
  trackingToken: string
  total: number
}

export async function createOrder(input: OrderInput): Promise<CreatedOrder> {
  // Le panier est fourni par le client : ces contrôles doivent avoir lieu
  // avant toute écriture, transaction ou non — une quantité négative ou
  // nulle ne doit jamais atteindre le décrément de stock.
  if (input.lines.length === 0) {
    throw new EmptyCartError()
  }
  for (const line of input.lines) {
    if (
      !Number.isInteger(line.quantity)
      || line.quantity <= 0
      || line.quantity > MAX_QUANTITY
    ) {
      throw new InvalidQuantityError(line.variantId)
    }
  }

  const initialStatus = input.channel === 'orange_money'
    ? 'en_attente_paiement'
    : input.channel === 'whatsapp'
      ? 'en_attente_confirmation'
      : 'confirmee'

  // Le stock est réservé dès la création pour les canaux orange_money et
  // livraison (cf. STOCK_COMMITTED) : le paiement orange_money encaisse
  // immédiatement, il ne doit pas pouvoir encaisser deux fois la même
  // dernière pièce en attendant la confirmation du webhook. Le canal
  // whatsapp (en_attente_confirmation) ne réserve rien : ces commandes
  // attendent un accord manuel qui peut ne jamais venir.
  const stockCommitted = STOCK_COMMITTED.includes(initialStatus)

  // Agrégation des quantités par déclinaison : deux lignes du panier sur
  // la même déclinaison doivent être vues comme une seule demande, sous
  // peine de laisser passer deux décréments sur un stock qui n'en
  // autorisait qu'un.
  const quantitiesByVariant = new Map<string, number>()
  for (const line of input.lines) {
    quantitiesByVariant.set(
      line.variantId,
      (quantitiesByVariant.get(line.variantId) ?? 0) + line.quantity,
    )
  }

  // MAX_QUANTITY est une borne « par déclinaison » : elle doit donc être
  // contrôlée sur la quantité agrégée, après regroupement, pas ligne par
  // ligne — sinon deux lignes de 20 sur la même déclinaison passeraient
  // alors que la commande porte en réalité sur 40 unités. Ce contrôle
  // s'ajoute à celui, ligne par ligne, fait plus haut : il ne le remplace
  // pas, car ce dernier est ce qui empêche des lignes de signe opposé
  // (+1 / -1) de s'annuler avant même d'atteindre l'agrégation.
  for (const [variantId, quantity] of quantitiesByVariant) {
    if (quantity > MAX_QUANTITY) {
      throw new InvalidQuantityError(variantId)
    }
  }

  return prisma.$transaction(async (tx) => {
    // Verrouillage explicite des lignes de variantes, dans un ordre stable
    // pour éviter les interblocages entre transactions concurrentes.
    const ids = [...quantitiesByVariant.keys()].sort()
    await tx.$queryRawUnsafe(
      `SELECT id FROM "Variant" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      ids,
    )

    const promotions = (await tx.promotion.findMany({ where: { actif: true } })) as PromotionRule[]
    const now = new Date()

    // Relecture des variantes après acquisition du verrou, via `tx` :
    // c'est cette relecture qui voit la version fraîche de la ligne et
    // permet une décision juste (servir si stock suffisant, OutOfStockError
    // sinon), plutôt qu'une décision prise sur une donnée périmée.
    const computedLines: {
      variantId: string
      nomFige: string
      prixUnitaireFige: number
      quantite: number
    }[] = []
    for (const [variantId, quantity] of quantitiesByVariant) {
      const variant = await tx.variant.findUnique({
        where: { id: variantId }, include: { product: true },
      })
      if (!variant) throw new VariantNotFoundError(variantId)
      if (!variant.product.actif) throw new ProductUnavailableError(variant.productId)
      if (variant.stock < quantity) throw new OutOfStockError(variantId)

      const { finalPrice } = resolvePrice({
        basePrice: variant.product.prixBase + variant.deltaPrix,
        productId: variant.productId,
        categoryId: variant.product.categoryId,
        promotions, now, isMember: input.isMember,
      })

      computedLines.push({
        variantId: variant.id,
        nomFige: `${variant.product.nom} — ${variant.libelle}`,
        prixUnitaireFige: finalPrice,
        quantite: quantity,
      })
    }

    let zone: { tarif: number } | null = null
    if (input.zoneId) {
      const z = await tx.deliveryZone.findUnique({ where: { id: input.zoneId } })
      if (!z || !z.actif) throw new InvalidZoneError(input.zoneId)
      zone = z
    }

    const totals = computeTotals(
      computedLines.map((l) => ({
        variantId: l.variantId, unitPrice: l.prixUnitaireFige, quantity: l.quantite,
      })),
      zone?.tarif ?? null,
    )

    const order = await tx.order.create({
      data: {
        reference: reference(),
        tokenSuivi: randomBytes(24).toString('base64url'),
        canal: input.channel,
        statut: initialStatus,
        clientNom: input.client.customerName,
        tel: input.client.phone,
        email: input.client.email ?? null,
        adresse: input.client.address ?? null,
        zoneId: input.zoneId,
        sousTotal: totals.subtotal,
        fraisLivraison: totals.shippingFee,
        remise: totals.discount,
        total: totals.total,
        items: { create: computedLines },
      },
    })

    if (stockCommitted) {
      for (const l of computedLines) {
        await tx.variant.update({
          where: { id: l.variantId },
          data: { stock: { decrement: l.quantite } },
        })
      }
    }

    return {
      id: order.id, reference: order.reference,
      trackingToken: order.tokenSuivi, total: order.total,
    }
  }, { timeout: 15000, maxWait: 5000 })
}
