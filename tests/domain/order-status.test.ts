import { describe, it, expect } from 'vitest'
import { transitionAutorisee, effetSurStock } from '@/domain/order-status'
import type { Statut } from '@/domain/order-status'

describe('transitionAutorisee', () => {
  it('autorise le passage de en_attente_paiement à confirmee', () => {
    expect(transitionAutorisee('en_attente_paiement', 'confirmee')).toBe(true)
  })
  it('refuse de revenir de livree à confirmee', () => {
    expect(transitionAutorisee('livree', 'confirmee')).toBe(false)
  })
  it('refuse toute sortie d\'un état terminal', () => {
    expect(transitionAutorisee('annulee', 'confirmee')).toBe(false)
    expect(transitionAutorisee('livree', 'annulee')).toBe(false)
  })
  it('autorise l\'annulation depuis confirmee', () => {
    expect(transitionAutorisee('confirmee', 'annulee')).toBe(true)
  })
  it('refuse une transition vers soi-même', () => {
    expect(transitionAutorisee('confirmee', 'confirmee')).toBe(false)
  })
})

describe('effetSurStock', () => {
  // en_attente_paiement engage désormais le stock dès la création de la
  // commande (canal orange_money, cf. STOCK_ENGAGE dans order-status.ts) :
  // la réservation a déjà eu lieu avant ces transitions, donc la
  // confirmation ne doit pas décompter une seconde fois.
  it('n\'engage pas le stock une seconde fois à la confirmation d\'une commande orange_money (réservé dès en_attente_paiement)', () => {
    expect(effetSurStock('en_attente_paiement', 'confirmee')).toBe('aucun')
  })
  it('décrémente aussi depuis en_attente_confirmation', () => {
    expect(effetSurStock('en_attente_confirmation', 'confirmee')).toBe('decrementer')
  })
  it('recrédite à l\'annulation d\'une commande confirmée', () => {
    expect(effetSurStock('confirmee', 'annulee')).toBe('recrediter')
  })
  it('recrédite à l\'annulation depuis en_preparation', () => {
    expect(effetSurStock('en_preparation', 'annulee')).toBe('recrediter')
  })
  it('recrédite le stock réservé si le paiement orange_money échoue', () => {
    expect(effetSurStock('en_attente_paiement', 'echec_paiement')).toBe('recrediter')
  })
  it('recrédite le stock réservé si une commande orange_money est annulée avant paiement', () => {
    expect(effetSurStock('en_attente_paiement', 'annulee')).toBe('recrediter')
  })
  it('ne recrédite rien à l\'annulation d\'une commande whatsapp : rien n\'avait été réservé', () => {
    expect(effetSurStock('en_attente_confirmation', 'annulee')).toBe('aucun')
  })
  it('ne touche pas au stock entre deux états post-confirmation', () => {
    expect(effetSurStock('en_preparation', 'expediee')).toBe('aucun')
  })
})

describe('effetSurStock — transitions interdites', () => {
  it('ne décrémente pas le stock d\'une commande annulée (survente)', () => {
    expect(effetSurStock('annulee', 'confirmee')).toBe('aucun')
  })
  it('ne recrédite pas un bijou déjà livré (stock fantôme)', () => {
    expect(effetSurStock('livree', 'annulee')).toBe('aucun')
  })
  it('ne décrémente pas depuis un échec de paiement vers confirmee', () => {
    expect(effetSurStock('echec_paiement', 'confirmee')).toBe('aucun')
  })
  it('ne décrémente pas en sautant l\'étape confirmee', () => {
    expect(effetSurStock('en_attente_confirmation', 'en_preparation')).toBe('aucun')
  })

  it('respecte l\'invariant : transition interdite => effet aucun, pour tous les couples possibles', () => {
    const statuts: Statut[] = [
      'en_attente_confirmation', 'en_attente_paiement', 'confirmee',
      'en_preparation', 'expediee', 'prete_retrait', 'livree',
      'annulee', 'echec_paiement',
    ]
    for (const de of statuts) {
      for (const vers of statuts) {
        if (!transitionAutorisee(de, vers)) {
          expect(effetSurStock(de, vers)).toBe('aucun')
        }
      }
    }
  })
})
