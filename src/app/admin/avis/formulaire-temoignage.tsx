'use client'

import { useActionState, useId } from 'react'
import type { EtatFormulaireTemoignage } from './etats'

function Erreurs({ messages, id }: { messages: string[] | undefined; id: string }) {
  if (!messages || messages.length === 0) return null
  return (
    <p id={id} role="alert" className="text-small text-bark">
      {messages.join(' ')}
    </p>
  )
}

/**
 * Saisie d'un témoignage reçu hors du site. Aucun champ « source » : un témoignage saisi
 * ici est toujours `importe` (voir importerTemoignage) — le badge « Achat vérifié » ne
 * s'obtient qu'en passant réellement commande.
 */
export function FormulaireTemoignage({
  action,
  produits,
}: {
  action: (
    etatPrecedent: EtatFormulaireTemoignage,
    formData: FormData,
  ) => Promise<EtatFormulaireTemoignage>
  produits: { id: string; nom: string }[]
}) {
  const [etat, soumettre, enCours] = useActionState<EtatFormulaireTemoignage, FormData>(action, {
    succes: false,
    erreurs: {},
    valeursInitiales: {},
  })
  const prefixe = useId()

  const valeur = (nom: string) => {
    const v = etat.valeursInitiales[nom]
    return v === undefined || v === null ? '' : String(v)
  }

  return (
    <form action={soumettre} className="flex flex-col gap-4 sm:max-w-xl">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefixe}-auteur`} className="text-small text-bark-soft">
          Autrice
        </label>
        <input
          id={`${prefixe}-auteur`}
          name="auteur"
          type="text"
          defaultValue={valeur('auteur')}
          aria-invalid={etat.erreurs['auteur'] ? true : undefined}
          aria-describedby={etat.erreurs['auteur'] ? `${prefixe}-auteur-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <Erreurs messages={etat.erreurs['auteur']} id={`${prefixe}-auteur-erreur`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefixe}-note`} className="text-small text-bark-soft">
          Note
        </label>
        <select
          id={`${prefixe}-note`}
          name="note"
          defaultValue={valeur('note') || '5'}
          aria-invalid={etat.erreurs['note'] ? true : undefined}
          aria-describedby={etat.erreurs['note'] ? `${prefixe}-note-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
        <Erreurs messages={etat.erreurs['note']} id={`${prefixe}-note-erreur`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefixe}-produit`} className="text-small text-bark-soft">
          Produit
        </label>
        <select
          id={`${prefixe}-produit`}
          name="productId"
          defaultValue={valeur('productId')}
          aria-invalid={etat.erreurs['productId'] ? true : undefined}
          aria-describedby={etat.erreurs['productId'] ? `${prefixe}-produit-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        >
          <option value="">Aucun produit en particulier</option>
          {produits.map((produit) => (
            <option key={produit.id} value={produit.id}>
              {produit.nom}
            </option>
          ))}
        </select>
        <Erreurs messages={etat.erreurs['productId']} id={`${prefixe}-produit-erreur`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefixe}-texte`} className="text-small text-bark-soft">
          Témoignage
        </label>
        <textarea
          id={`${prefixe}-texte`}
          name="texte"
          rows={3}
          defaultValue={valeur('texte')}
          aria-invalid={etat.erreurs['texte'] ? true : undefined}
          aria-describedby={etat.erreurs['texte'] ? `${prefixe}-texte-erreur` : undefined}
          className="rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <Erreurs messages={etat.erreurs['texte']} id={`${prefixe}-texte-erreur`} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90 disabled:opacity-60"
        >
          {enCours ? 'Enregistrement…' : 'Importer le témoignage'}
        </button>
        {etat.succes ? (
          <span role="status" className="text-small text-bark-soft">
            Témoignage importé.
          </span>
        ) : null}
      </div>
    </form>
  )
}
