'use client'

import { useActionState } from 'react'
import type { EtatFormulaireProduit } from './etats'

type Categorie = { id: string; nom: string }

function texteInitial(valeurs: Record<string, unknown>, nom: string): string {
  const v = valeurs[nom]
  return v === undefined || v === null ? '' : String(v)
}

// `idErreur`/`enErreur` relient le champ à son message via aria-describedby/aria-invalid —
// même câblage que ChampSaisie dans src/admin/engine/form.tsx, pour qu'un lecteur d'écran
// annonce l'erreur au moment où il atteint le champ, pas seulement quand elle apparaît
// visuellement.
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

// Formulaire produit hand-écrit (plutôt que le <AdminForm> générique du moteur,
// src/admin/engine/form.tsx) pour deux raisons propres à cette ressource : `categoryId` a
// besoin d'un vrai menu déroulant sur les catégories existantes (le moteur ne produit un
// <select> que pour un champ zod `enum`, pas pour une relation dont les valeurs viennent de
// la base), et les messages d'erreur doivent s'afficher sans rechargement complet via
// useActionState (React 19 / Next.js — voir node_modules/next/dist/docs/01-app/
// 01-getting-started/10-error-handling.md, section « Handling expected errors » : les
// erreurs de validation attendues sont modélisées comme des valeurs de retour, pas levées).
// La validation elle-même (`validerFormData(productsResource, ...)` dans actions.ts) reste
// celle du moteur, pilotée par le même schéma Zod.
//
// Volontairement sans attribut HTML `required` : la validation serveur (Zod, en français)
// est la seule source de vérité affichée. Un `required` natif bloquerait la soumission
// avant même d'atteindre le serveur, empêchant d'afficher les messages français dédiés en
// dessous de chaque champ.
export function FormulaireProduit({
  action,
  etatInitial,
  categories,
  libelleSoumettre,
}: {
  action: (etatPrecedent: EtatFormulaireProduit, formData: FormData) => Promise<EtatFormulaireProduit>
  etatInitial: EtatFormulaireProduit
  categories: Categorie[]
  libelleSoumettre: string
}) {
  const [etat, soumettre, enCours] = useActionState(action, etatInitial)
  const v = etat.valeursInitiales

  const categorieParDefaut = texteInitial(v, 'categoryId') || (categories[0]?.id ?? '')
  const prixAchatParDefaut = texteInitial(v, 'prixAchat') || '0'
  const ordreParDefaut = texteInitial(v, 'ordre') || '0'
  const actifParDefaut = v.actif === undefined ? true : Boolean(v.actif)

  const nomEnErreur = Boolean(etat.erreurs.nom?.length)
  const slugEnErreur = Boolean(etat.erreurs.slug?.length)
  const descriptionEnErreur = Boolean(etat.erreurs.description?.length)
  const categoryIdEnErreur = Boolean(etat.erreurs.categoryId?.length)
  const prixBaseEnErreur = Boolean(etat.erreurs.prixBase?.length)
  const prixAchatEnErreur = Boolean(etat.erreurs.prixAchat?.length)
  const ordreEnErreur = Boolean(etat.erreurs.ordre?.length)

  return (
    <form action={soumettre} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="produit-nom" className="text-small text-bark-soft">
          Nom
        </label>
        <input
          id="produit-nom"
          name="nom"
          type="text"
          defaultValue={texteInitial(v, 'nom')}
          aria-invalid={nomEnErreur || undefined}
          aria-describedby={nomEnErreur ? 'produit-nom-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <ChampErreurs id="produit-nom-erreur" messages={etat.erreurs.nom} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-slug" className="text-small text-bark-soft">
          Slug
        </label>
        <input
          id="produit-slug"
          name="slug"
          type="text"
          defaultValue={texteInitial(v, 'slug')}
          aria-invalid={slugEnErreur || undefined}
          aria-describedby={slugEnErreur ? 'produit-slug-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <p className="text-small text-bark-soft">Minuscules, chiffres et tirets uniquement.</p>
        <ChampErreurs id="produit-slug-erreur" messages={etat.erreurs.slug} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-description" className="text-small text-bark-soft">
          Description
        </label>
        <textarea
          id="produit-description"
          name="description"
          rows={4}
          defaultValue={texteInitial(v, 'description')}
          aria-invalid={descriptionEnErreur || undefined}
          aria-describedby={descriptionEnErreur ? 'produit-description-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        />
        <ChampErreurs id="produit-description-erreur" messages={etat.erreurs.description} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-categoryId" className="text-small text-bark-soft">
          Catégorie
        </label>
        <select
          id="produit-categoryId"
          name="categoryId"
          defaultValue={categorieParDefaut}
          aria-invalid={categoryIdEnErreur || undefined}
          aria-describedby={categoryIdEnErreur ? 'produit-categoryId-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark"
        >
          {categories.length === 0 ? <option value="">Aucune catégorie disponible</option> : null}
          {categories.map((categorie) => (
            <option key={categorie.id} value={categorie.id}>
              {categorie.nom}
            </option>
          ))}
        </select>
        <ChampErreurs id="produit-categoryId-erreur" messages={etat.erreurs.categoryId} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-prixBase" className="text-small text-bark-soft">
          Prix
        </label>
        <input
          id="produit-prixBase"
          name="prixBase"
          type="number"
          defaultValue={texteInitial(v, 'prixBase')}
          aria-invalid={prixBaseEnErreur || undefined}
          aria-describedby={prixBaseEnErreur ? 'produit-prixBase-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <ChampErreurs id="produit-prixBase-erreur" messages={etat.erreurs.prixBase} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-prixAchat" className="text-small text-bark-soft">
          Prix d&apos;achat
        </label>
        <input
          id="produit-prixAchat"
          name="prixAchat"
          type="number"
          defaultValue={prixAchatParDefaut}
          aria-invalid={prixAchatEnErreur || undefined}
          aria-describedby={prixAchatEnErreur ? 'produit-prixAchat-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <ChampErreurs id="produit-prixAchat-erreur" messages={etat.erreurs.prixAchat} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="produit-ordre" className="text-small text-bark-soft">
          Ordre d&apos;affichage
        </label>
        <input
          id="produit-ordre"
          name="ordre"
          type="number"
          defaultValue={ordreParDefaut}
          aria-invalid={ordreEnErreur || undefined}
          aria-describedby={ordreEnErreur ? 'produit-ordre-erreur' : undefined}
          className="w-full rounded border border-taupe/40 bg-shell px-3 py-2 text-bark tabular-nums"
        />
        <p className="text-small text-bark-soft">
          Détermine la position du produit dans la vitrine ; les valeurs les plus basses
          apparaissent en premier.
        </p>
        <ChampErreurs id="produit-ordre-erreur" messages={etat.erreurs.ordre} />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="produit-actif"
          name="actif"
          type="checkbox"
          defaultChecked={actifParDefaut}
          className="h-4 w-4 rounded border-taupe/40"
        />
        <label htmlFor="produit-actif" className="text-small text-bark-soft">
          Actif (visible en boutique)
        </label>
      </div>

      {etat.succes ? (
        <p role="status" className="text-small text-bark-soft">
          Modifications enregistrées.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enCours}
        className="self-start rounded border border-taupe/40 bg-sage-deep px-4 py-2 text-shell hover:opacity-90 disabled:opacity-60"
      >
        {libelleSoumettre}
      </button>
    </form>
  )
}
