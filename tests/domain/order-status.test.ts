import { describe, it, expect } from 'vitest'
import { transitionAllowed, stockEffect } from '@/domain/order-status'
import type { OrderStatus } from '@/domain/order-status'

describe('transitionAllowed', () => {
  it('autorise le passage de en_attente_paiement à confirmee', () => {
    expect(transitionAllowed('en_attente_paiement', 'confirmee')).toBe(true)
  })
  it('refuse de revenir de livree à confirmee', () => {
    expect(transitionAllowed('livree', 'confirmee')).toBe(false)
  })
  it('refuse toute sortie d\'un état terminal', () => {
    expect(transitionAllowed('annulee', 'confirmee')).toBe(false)
    expect(transitionAllowed('livree', 'annulee')).toBe(false)
  })
  it('autorise l\'annulation depuis confirmee', () => {
    expect(transitionAllowed('confirmee', 'annulee')).toBe(true)
  })
  it('refuse une transition vers soi-même', () => {
    expect(transitionAllowed('confirmee', 'confirmee')).toBe(false)
  })
})

describe('stockEffect', () => {
  // en_attente_paiement engage désormais le stock dès la création de la
  // commande (canal orange_money, cf. STOCK_COMMITTED dans order-status.ts) :
  // la réservation a déjà eu lieu avant ces transitions, donc la
  // confirmation ne doit pas décompter une seconde fois.
  it('n\'engage pas le stock une seconde fois à la confirmation d\'une commande orange_money (réservé dès en_attente_paiement)', () => {
    expect(stockEffect('en_attente_paiement', 'confirmee')).toBe('none')
  })
  it('décrémente aussi depuis en_attente_confirmation', () => {
    expect(stockEffect('en_attente_confirmation', 'confirmee')).toBe('decrement')
  })
  it('recrédite à l\'annulation d\'une commande confirmée', () => {
    expect(stockEffect('confirmee', 'annulee')).toBe('credit_back')
  })
  it('recrédite à l\'annulation depuis en_preparation', () => {
    expect(stockEffect('en_preparation', 'annulee')).toBe('credit_back')
  })
  it('recrédite le stock réservé si le paiement orange_money échoue', () => {
    expect(stockEffect('en_attente_paiement', 'echec_paiement')).toBe('credit_back')
  })
  it('recrédite le stock réservé si une commande orange_money est annulée avant paiement', () => {
    expect(stockEffect('en_attente_paiement', 'annulee')).toBe('credit_back')
  })
  it('ne recrédite rien à l\'annulation d\'une commande whatsapp : rien n\'avait été réservé', () => {
    expect(stockEffect('en_attente_confirmation', 'annulee')).toBe('none')
  })
  it('ne touche pas au stock entre deux états post-confirmation', () => {
    expect(stockEffect('en_preparation', 'expediee')).toBe('none')
  })
})

describe('stockEffect — transitions interdites', () => {
  it('ne décrémente pas le stock d\'une commande annulée (survente)', () => {
    expect(stockEffect('annulee', 'confirmee')).toBe('none')
  })
  it('ne recrédite pas un bijou déjà livré (stock fantôme)', () => {
    expect(stockEffect('livree', 'annulee')).toBe('none')
  })
  it('ne décrémente pas depuis un échec de paiement vers confirmee', () => {
    expect(stockEffect('echec_paiement', 'confirmee')).toBe('none')
  })
  it('ne décrémente pas en sautant l\'étape confirmee', () => {
    expect(stockEffect('en_attente_confirmation', 'en_preparation')).toBe('none')
  })

  it('respecte l\'invariant : transition interdite => effet aucun, pour tous les couples possibles', () => {
    const statuts: OrderStatus[] = [
      'en_attente_confirmation', 'en_attente_paiement', 'confirmee',
      'en_preparation', 'expediee', 'prete_retrait', 'livree',
      'annulee', 'echec_paiement',
    ]
    for (const de of statuts) {
      for (const vers of statuts) {
        if (!transitionAllowed(de, vers)) {
          expect(stockEffect(de, vers)).toBe('none')
        }
      }
    }
  })
})
