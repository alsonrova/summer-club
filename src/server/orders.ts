import { randomBytes } from 'node:crypto'
import { prisma } from './db'
import { resolvePrix } from '@/domain/pricing'
import { calculerTotaux } from '@/domain/cart'
import { STOCK_ENGAGE } from '@/domain/order-status'
import type { PromotionRule } from '@/domain/types'

/** Classe de base de toutes les erreurs métier levées par ce module. */
export class CommandeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class RuptureStockError extends CommandeError {
  constructor(public readonly variantId: string) {
    super('Stock insuffisant')
    this.name = 'RuptureStockError'
  }
}

export class PanierVideError extends CommandeError {
  constructor() {
    super('Le panier est vide')
    this.name = 'PanierVideError'
  }
}

export class QuantiteInvalideError extends CommandeError {
  constructor(public readonly variantId: string) {
    super('La quantité demandée pour cet article est invalide')
    this.name = 'QuantiteInvalideError'
  }
}

export class VariantIntrouvableError extends CommandeError {
  constructor(public readonly variantId: string) {
    super("Cet article n'existe pas ou n'est plus disponible")
    this.name = 'VariantIntrouvableError'
  }
}

export class ProduitIndisponibleError extends CommandeError {
  constructor(public readonly productId: string) {
    super("Ce produit n'est plus en vente")
    this.name = 'ProduitIndisponibleError'
  }
}

export class ZoneInvalideError extends CommandeError {
  constructor(public readonly zoneId: string) {
    super("La zone de livraison sélectionnée n'est pas valide")
    this.name = 'ZoneInvalideError'
  }
}

/** Quantité maximale par déclinaison, alignée sur la borne du panier côté client. */
const QUANTITE_MAX = 20

function reference(): string {
  return `SC-${randomBytes(6).toString('hex').toUpperCase()}`
}

export type CommandeInput = {
  lignes: { variantId: string; quantite: number }[]
  canal: 'orange_money' | 'whatsapp' | 'livraison'
  client: { nom: string; tel: string; email?: string; adresse?: string }
  zoneId: string | null
  estMembre: boolean
}

export type CommandeCreee = {
  id: string
  reference: string
  tokenSuivi: string
  total: number
}

export async function creerCommande(input: CommandeInput): Promise<CommandeCreee> {
  // Le panier est fourni par le client : ces contrôles doivent avoir lieu
  // avant toute écriture, transaction ou non — une quantité négative ou
  // nulle ne doit jamais atteindre le décrément de stock.
  if (input.lignes.length === 0) {
    throw new PanierVideError()
  }
  for (const ligne of input.lignes) {
    if (
      !Number.isInteger(ligne.quantite)
      || ligne.quantite <= 0
      || ligne.quantite > QUANTITE_MAX
    ) {
      throw new QuantiteInvalideError(ligne.variantId)
    }
  }

  const statutInitial = input.canal === 'orange_money'
    ? 'en_attente_paiement'
    : input.canal === 'whatsapp'
      ? 'en_attente_confirmation'
      : 'confirmee'

  // Le stock est réservé dès la création pour les canaux orange_money et
  // livraison (cf. STOCK_ENGAGE) : le paiement orange_money encaisse
  // immédiatement, il ne doit pas pouvoir encaisser deux fois la même
  // dernière pièce en attendant la confirmation du webhook. Le canal
  // whatsapp (en_attente_confirmation) ne réserve rien : ces commandes
  // attendent un accord manuel qui peut ne jamais venir.
  const engageStock = STOCK_ENGAGE.includes(statutInitial)

  // Agrégation des quantités par déclinaison avant tout contrôle : deux
  // lignes du panier sur la même déclinaison doivent être vues comme une
  // seule demande, sous peine de laisser passer deux décréments sur un
  // stock qui n'en autorisait qu'un.
  const quantitesParVariant = new Map<string, number>()
  for (const ligne of input.lignes) {
    quantitesParVariant.set(
      ligne.variantId,
      (quantitesParVariant.get(ligne.variantId) ?? 0) + ligne.quantite,
    )
  }

  return prisma.$transaction(async (tx) => {
    // Verrouillage explicite des lignes de variantes, dans un ordre stable
    // pour éviter les interblocages entre transactions concurrentes.
    const ids = [...quantitesParVariant.keys()].sort()
    await tx.$queryRawUnsafe(
      `SELECT id FROM "Variant" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      ids,
    )

    const promotions = (await tx.promotion.findMany({ where: { actif: true } })) as PromotionRule[]
    const maintenant = new Date()

    // Relecture des variantes après acquisition du verrou, via `tx` :
    // c'est cette relecture qui voit la version fraîche de la ligne et
    // permet une décision juste (servir si stock suffisant, RuptureStockError
    // sinon), plutôt qu'une décision prise sur une donnée périmée.
    const lignesCalculees: {
      variantId: string
      nomFige: string
      prixUnitaireFige: number
      quantite: number
    }[] = []
    for (const [variantId, quantite] of quantitesParVariant) {
      const variant = await tx.variant.findUnique({
        where: { id: variantId }, include: { product: true },
      })
      if (!variant) throw new VariantIntrouvableError(variantId)
      if (!variant.product.actif) throw new ProduitIndisponibleError(variant.productId)
      if (variant.stock < quantite) throw new RuptureStockError(variantId)

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
        quantite,
      })
    }

    let zone: { tarif: number } | null = null
    if (input.zoneId) {
      const z = await tx.deliveryZone.findUnique({ where: { id: input.zoneId } })
      if (!z || !z.actif) throw new ZoneInvalideError(input.zoneId)
      zone = z
    }

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

    if (engageStock) {
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
  }, { timeout: 15000, maxWait: 5000 })
}
