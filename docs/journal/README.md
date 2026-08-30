# Journal des agents

## À quoi il sert

Ce projet est construit par des agents d'intelligence artificielle qui se succèdent sans
mémoire commune. Chaque session repart de zéro : elle ne sait ni ce qui a déjà été tenté, ni
ce qui a été trouvé puis corrigé, ni ce qu'un relecteur a diagnostiqué à tort et qu'il ne faut
pas rediagnostiquer.

Le journal est cette mémoire. Il répond à quatre questions :

1. **Qui a fait quoi**, sur quelle tâche, avec quel modèle, et dans quel commit.
2. **Ce qui a été trouvé** — par sévérité — et par qui.
3. **Ce qui reste incertain** : les réserves, c'est-à-dire ce que l'agent n'a pas pu vérifier
   et qu'il refuse d'affirmer.
4. **L'état des tests avant et après**, pour qu'une régression se voie au lieu de se deviner.

C'est aussi ce qui rend le travail opposable. Trois affirmations fausses ont été prises en
flagrant délit sur la seule tâche 12 ; un diagnostic erroné s'est propagé dans trois documents
avant d'être purgé. Un journal daté, versionné et non réécrit rend ces dérives visibles.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `entries.jsonl` | **La source de vérité.** Une entrée JSON par ligne, append-only. |
| `JOURNAL.md` | Récapitulatif lisible, **engendré** — ne le modifiez jamais à la main. |
| `README.md` | Ce document. |

L'outil qui les manipule vit dans `tools/agent-journal/` : JavaScript en `.mjs`, modules
natifs de Node uniquement, aucune dépendance.

## Qui écrit, et qui remet

À la fin de votre intervention, une entrée. Toujours — mais ce n'est pas toujours vous qui
la tapez.

| Votre rôle | Ce que vous faites |
| --- | --- |
| Développeur, coordinateur | vous lancez la commande vous-même |
| **Auditeur, testeur UX/UI** | **vous ne l'exécutez pas** : vous êtes en lecture seule |

Les agents de vérification travaillent sans modifier aucun fichier (`docs/CONVENTIONS.md`
§ 8) — et `entries.jsonl` est un fichier. Un vérificateur qui consignerait lui-même
enfreindrait la règle qu'il est là pour faire respecter, et pourrait écrire sous les yeux
d'un autre agent en train de lire le même arbre. **Vous rédigez donc votre entrée sous forme
de ligne de commande complète, prête à coller, et vous la remettez au coordinateur dans votre
rapport.** C'est lui qui l'inscrit, telle quelle.

L'obligation ne bouge pas ; seule la main qui écrit change.

## Comment l'alimenter

```bash
npm run journal -- add \
  --task 13 \
  --role developer \
  --model claude-opus-5 \
  --summary "Vitrine : liste des produits, filtres par catégorie, pagination." \
  --files src/app/boutique/page.tsx --files src/app/boutique/query.ts \
  --commit a1b2c3d \
  --tests-before "<sortie réelle de npm test AVANT>" \
  --tests-after  "<sortie réelle de npm test APRÈS>" \
  --verdict delivered \
  --caveat "Le tri par prix n'est pas couvert en bout en bout."

npm run journal:render          # met JOURNAL.md à jour
git add docs/journal && git commit -m "chore: consigne la tache 13 au journal"
```

Consultation :

```bash
npm run journal -- list                        # tout
npm run journal -- list --task 12              # une tâche
npm run journal -- list --role auditor         # un rôle
npm run journal -- list --task 12 --role auditor --json
npm run journal -- help                        # toutes les options
```

`npm run journal:add`, `npm run journal:list` et `npm run journal:render` sont des raccourcis
des trois commandes ci-dessus.

## Les champs

| Champ | Obligatoire | Contenu |
| --- | --- | --- |
| `timestamp` | oui (défaut : maintenant) | ISO 8601 |
| `task` | oui | identifiant de tâche, ex. `12` |
| `role` | oui | `developer`, `auditor`, `ux-tester`, `coordinator` |
| `summary` | oui | ce qui a été fait, en français, sans enjoliver |
| `verdict` | oui | `delivered`, `approved`, `changes-requested`, `rejected`, `noted` |
| `model` | non | le modèle qui a produit le travail |
| `commit` | non | 7 à 40 caractères hexadécimaux, refusé sinon |
| `files` | non | fichiers touchés, une option `--files` par fichier |
| `testsBefore` / `testsAfter` | non | chiffres **mesurés**, jamais estimés ni recopiés d'un exemple |
| `findings` | non | constats par sévérité : `critical`, `important`, `minor` |
| `caveats` | non | ce qui reste incertain, ce qui n'a pas pu être vérifié |
| `source` | non | `live` (défaut) ou `reconstructed` |

Les clés sont en anglais, les valeurs en français : c'est la règle du dépôt
(`docs/CONVENTIONS.md`, § 1 — l'anglais s'arrête aux identifiants).

**Un champ dont vous ne connaissez pas la valeur reste vide.** Ne remplissez jamais un chiffre
au jugé — et ne recopiez pas celui de l'exemple ci-dessus, écrit en gabarit précisément pour
ne pas pouvoir l'être. `testsBefore` et `testsAfter` sont la **sortie réelle** de `npm test`
(et de `npx --no-install playwright test`) lancés avant puis après votre intervention. Un journal qui invente est pire qu'un journal incomplet : il donne à la session
suivante une confiance qu'elle n'a pas de raison d'avoir.

## Append-only

`add` n'ouvre jamais le fichier en écriture : il ajoute une ligne à la fin. **On ne corrige
pas une entrée passée, on en ajoute une qui la rectifie.** C'est le même principe que le
journal d'audit de l'application (`src/server/audit.ts`) : une trace qu'on peut réécrire ne
prouve rien.

Quatre garde-fous, tous couverts par `tests/tools/agent-journal.test.ts` :

- **Une ligne illisible fait échouer la lecture**, en citant son numéro. L'alternative — sauter
  la ligne et continuer — ferait disparaître une entrée sans un mot. C'est exactement ce qu'un
  journal ne doit jamais faire.
- **`add` refuse d'écrire derrière un fichier qui ne se termine pas par un saut de ligne.**
  C'est le signe d'une écriture précédente interrompue ; ajouter à la suite fusionnerait deux
  entrées en une ligne illisible, donc en perdrait deux.
- **Une entrée d'un format plus récent fait échouer la lecture** au lieu d'être relue avec les
  règles d'aujourd'hui. C'est tout ce qu'apporte le champ `schemaVersion`, et il ne promet rien
  d'autre : aucune conversion d'un format vers un autre n'existe. Un outil qui rencontre une
  version qu'il ne connaît pas le dit, plutôt que de comprendre l'entrée de travers en silence.
- **`add` confirme l'écriture AVANT de compter.** Le total affiché relit tout le fichier ;
  si le journal porte déjà une ligne abîmée, cette relecture échoue. Annoncer une erreur à ce
  moment-là ferait ressaisir une entrée déjà écrite — donc un doublon. L'échec du total est
  donc un **avertissement** séparé, qui dit explicitement que l'entrée est enregistrée.

## Pourquoi versionné, alors que `.superpowers/` ne l'est pas

`.superpowers/` est un dossier de **travail de session** : briefs, rapports bruts, diffs de
revue. Il est explicitement ignoré par `.gitignore`. Il vit le temps d'une session sur une
machine, et disparaît avec elle — il ne convient pas à un outil durable.

Le journal, lui, est **le produit** de ce travail, pas son échafaudage :

- Il **suit le code**. Une entrée qui cite un commit doit voyager avec ce commit : clonez le
  dépôt ailleurs et l'histoire est là.
- Il est **daté par git** en plus de l'être par lui-même. On peut voir quand une entrée a été
  écrite, et donc si elle a été écrite après coup.
- Il **survit à la machine**. Le ledger de session (`.superpowers/sdd/progress.md`) contenait
  la seule trace écrite de règles capitales — ne pas combiner Serializable et `FOR UPDATE`, ne
  jamais masquer une intermittence par une sérialisation. Ces règles vivent désormais dans
  `docs/CONVENTIONS.md`, et le journal en garde la genèse.

## Les 51 premières entrées

Le journal a été amorcé avec l'histoire réelle des douze tâches déjà livrées, reconstituée à
partir de `.superpowers/sdd/progress.md`, des rapports de tâches et de `git log`.

Ces entrées portent `"source": "reconstructed"` et le récapitulatif les signale. La nuance
compte : **leur horodatage est celui d'un commit réel, pas l'heure à laquelle l'agent a
travaillé** — cette heure-là n'a jamais été enregistrée. Les entrées d'audit, qui ne produisent
pas de commit, sont calées sur le commit de correction qui en a découlé.

Le champ `model` est vide presque partout : il n'a pas été consigné à l'époque. Une seule
exception, `haiku` sur la revue de la tâche 3, parce que le ledger de session le mentionne.
C'est précisément le genre d'information que ce journal existe pour ne plus perdre.
