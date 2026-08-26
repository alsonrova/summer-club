'use client'

import { useActionState } from 'react'
import type { EtatFormulaireDeclinaison } from '../etats'
import { formatAriary } from '@/domain/money'

function texteInitial(valeurs: Record<string, unknown>, nom: string): string {
  const v = valeurs[nom]
  return v === undefined || v === null ? '' : String(v)
}

function ChampErreurs({ id, messages }: { id: string; messages: string[] | undefined }) {
  if (!messages?.length) return null
  return (
    <div id={id}>
      {messages.map((message) => (
        <p key={message} role="alert" className="text-small text-bark">
          {message}
        </p>
      ))}
    </div>
  )
}

// Formulaire hand-écrit, dans le même esprit que FormulaireProduit (../formulaire-
// produit.tsx) : validation serveur seule source de vérité (pas de `required` HTML),
// messages d'erreur affichés sans rechargement via useActionState. `prixBase` sert
// uniquement à rappeler le calcul déjà affiché dans le tableau des déclinaisons
// existantes ; l'action serveur (creerDeclinaison) revalide ce même calcul, ce texte
// n'est qu'indicatif.
export function FormulaireDeclinaison({
  action,
  prixBase,
}: {
  action: (
    etatPrecedent: EtatFormulaireDeclinaison,
    formData: FormData,
  ) => Promise<EtatFormulaireDeclinaison>
  prixBase: number
}) {
  const [etat, soumettre, enCours] = useActionState(action, {
    succes: false,
    erreurs: {},
    valeursInitiales: {},
  })
  const v = etat.valeursInitiales

  const libelleEnErreur = Boolean(etat.erreurs.libelle?.length)
  const skuEnErreur = Boolean(etat.erreurs.sku?.length)
  const deltaPrixEnErreur = Boolean(etat.erreurs.deltaPrix?.length)
  const stockEnErreur = Boolean(etat.erreurs.stock?.length)

  return (
    <form action={soumettre} className="mt-4 flex max-w-lg flex-col gap-4">
      <h3 className="font-display text-lg font-light text-bark">Nouvelle déclinaison</h3>

      <div className="flex flex-col gap-1">
        <label htmlFor="declinaison-libelle" className="text-small text-bark-soft">
          Libellé
        </label>
        <input
          id="declinaison-libelle"
          name="libelle"
          type="text"
          defaultValue={texteInitial(v, 'libelle')}
          aria-invalid={libelleEnErreur || undefined}
          aria-describedby={libelleEnErreur ? 'declinaison-libelle-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <ChampErreurs id="declinaison-libelle-erreur" messages={etat.erreurs.libelle} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="declinaison-sku" className="text-small text-bark-soft">
          SKU
        </label>
        <input
          id="declinaison-sku"
          name="sku"
          type="text"
          defaultValue={texteInitial(v, 'sku')}
          aria-invalid={skuEnErreur || undefined}
          aria-describedby={skuEnErreur ? 'declinaison-sku-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <p className="text-small text-bark-soft">Lettres, chiffres et tirets uniquement.</p>
        <ChampErreurs id="declinaison-sku-erreur" messages={etat.erreurs.sku} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="declinaison-deltaPrix" className="text-small text-bark-soft">
          Écart de prix
        </label>
        <input
          id="declinaison-deltaPrix"
          name="deltaPrix"
          type="number"
          defaultValue={texteInitial(v, 'deltaPrix') || '0'}
          aria-invalid={deltaPrixEnErreur || undefined}
          aria-describedby={deltaPrixEnErreur ? 'declinaison-deltaPrix-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <p className="text-small text-bark-soft">
          Ajouté au prix de base ({formatAriary(prixBase)}) ; peut être négatif. Le résultat
          doit rester positif.
        </p>
        <ChampErreurs id="declinaison-deltaPrix-erreur" messages={etat.erreurs.deltaPrix} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="declinaison-stock" className="text-small text-bark-soft">
          Stock
        </label>
        <input
          id="declinaison-stock"
          name="stock"
          type="number"
          defaultValue={texteInitial(v, 'stock') || '0'}
          aria-invalid={stockEnErreur || undefined}
          aria-describedby={stockEnErreur ? 'declinaison-stock-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <ChampErreurs id="declinaison-stock-erreur" messages={etat.erreurs.stock} />
      </div>

      {etat.succes ? (
        <p role="status" className="text-small text-bark-soft">
          Déclinaison créée.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enCours}
        className="self-start rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90 disabled:opacity-60"
      >
        Ajouter la déclinaison
      </button>
    </form>
  )
}
