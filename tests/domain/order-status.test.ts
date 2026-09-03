import { describe, it, expect } from 'vitest'
import { transitionAllowed, stockEffect } from '@/domain/order-status'
import type { OrderStatus } from '@/domain/order-status'

describe('transitionAllowed', () => {
  it('autorise le passage de en_attente_paiement à confirmee', () => {
    expect(transitionAllowed('pending_payment', 'confirmed')).toBe(true)
  })
  it('refuse de revenir de livree à confirmee', () => {
    expect(transitionAllowed('delivered', 'confirmed')).toBe(false)
  })
  it('refuse toute sortie d\'un état terminal', () => {
    expect(transitionAllowed('cancelled', 'confirmed')).toBe(false)
    expect(transitionAllowed('delivered', 'cancelled')).toBe(false)
  })
  it('autorise l\'annulation depuis confirmee', () => {
    expect(transitionAllowed('confirmed', 'cancelled')).toBe(true)
  })
  it('refuse une transition vers soi-même', () => {
    expect(transitionAllowed('confirmed', 'confirmed')).toBe(false)
  })
})

describe('stockEffect', () => {
  // en_attente_paiement engage désormais le stock dès la création de la
  // commande (canal orange_money, cf. STOCK_COMMITTED dans order-status.ts) :
  // la réservation a déjà eu lieu avant ces transitions, donc la
  // confirmation ne doit pas décompter une seconde fois.
  it('n\'engage pas le stock une seconde fois à la confirmation d\'une commande orange_money (réservé dès en_attente_paiement)', () => {
    expect(stockEffect('pending_payment', 'confirmed')).toBe('none')
  })
  it('décrémente aussi depuis en_attente_confirmation', () => {
    expect(stockEffect('pending_confirmation', 'confirmed')).toBe('decrement')
  })
  it('recrédite à l\'annulation d\'une commande confirmée', () => {
    expect(stockEffect('confirmed', 'cancelled')).toBe('credit_back')
  })
  it('recrédite à l\'annulation depuis en_preparation', () => {
    expect(stockEffect('preparing', 'cancelled')).toBe('credit_back')
  })
  it('recrédite le stock réservé si le paiement orange_money échoue', () => {
    expect(stockEffect('pending_payment', 'payment_failed')).toBe('credit_back')
  })
  it('recrédite le stock réservé si une commande orange_money est annulée avant paiement', () => {
    expect(stockEffect('pending_payment', 'cancelled')).toBe('credit_back')
  })
  it('ne recrédite rien à l\'annulation d\'une commande whatsapp : rien n\'avait été réservé', () => {
    expect(stockEffect('pending_confirmation', 'cancelled')).toBe('none')
  })
  it('ne touche pas au stock entre deux états post-confirmation', () => {
    expect(stockEffect('preparing', 'shipped')).toBe('none')
  })
})

describe('stockEffect — transitions interdites', () => {
  it('ne décrémente pas le stock d\'une commande annulée (survente)', () => {
    expect(stockEffect('cancelled', 'confirmed')).toBe('none')
  })
  it('ne recrédite pas un bijou déjà livré (stock fantôme)', () => {
    expect(stockEffect('delivered', 'cancelled')).toBe('none')
  })
  it('ne décrémente pas depuis un échec de paiement vers confirmee', () => {
    expect(stockEffect('payment_failed', 'confirmed')).toBe('none')
  })
  it('ne décrémente pas en sautant l\'étape confirmee', () => {
    expect(stockEffect('pending_confirmation', 'preparing')).toBe('none')
  })

  it('respecte l\'invariant : transition interdite => effet aucun, pour tous les couples possibles', () => {
    const statuses: OrderStatus[] = [
      'pending_confirmation', 'pending_payment', 'confirmed',
      'preparing', 'shipped', 'ready_for_pickup', 'delivered',
      'cancelled', 'payment_failed',
    ]
    for (const from of statuses) {
      for (const to of statuses) {
        if (!transitionAllowed(from, to)) {
          expect(stockEffect(from, to)).toBe('none')
        }
      }
    }
  })
})
