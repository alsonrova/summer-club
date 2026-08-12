import { describe, it, expect } from 'vitest'
import { transitionAutorisee, effetSurStock } from '@/domain/order-status'

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
  it('décrémente à l\'entrée en confirmee', () => {
    expect(effetSurStock('en_attente_paiement', 'confirmee')).toBe('decrementer')
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
  it('ne touche pas au stock si la commande n\'a jamais été confirmée', () => {
    expect(effetSurStock('en_attente_paiement', 'echec_paiement')).toBe('aucun')
  })
  it('ne touche pas au stock entre deux états post-confirmation', () => {
    expect(effetSurStock('en_preparation', 'expediee')).toBe('aucun')
  })
})
