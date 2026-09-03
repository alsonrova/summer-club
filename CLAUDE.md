# Summer Club — point d'entrée pour les agents

**Lisez `docs/CONVENTIONS.md` avant d'écrire une ligne.** C'est le document qui fait autorité
sur ce dépôt : langue, architecture, sécurité, tests, rôles d'agents. Il l'emporte sur toute
habitude venue d'un autre projet.

- Conventions : `docs/CONVENTIONS.md`
- Renommage des identifiants français : chantier exécuté les 2026-09-03/04 (journal, tâche
  `renommage`, verdict approuvé). `docs/RENOMMAGE.md` reste la trace de ce qui a été
  appliqué — table de correspondance, points de vigilance, ordre d'exécution suivi — pas une
  liste de travail en attente. La règle qui s'applique désormais à tout code, neuf ou touché,
  est le critère de validité du propriétaire (`docs/CONVENTIONS.md` § 1) : un identifiant
  français rend la contribution invalide, sans exception d'ancienneté.
- Journal des agents : `docs/journal/README.md` — consignez votre intervention en fin de tâche
  (en lecture seule ? remettez la commande au coordinateur, ne l'exécutez pas)
- Dernière passation : `docs/passation/` (le fichier le plus récent)
- Spécification : `docs/superpowers/specs/` · Plan : `docs/superpowers/plans/`

@AGENTS.md

> `AGENTS.md` est réécrit automatiquement par `next dev` (voir
> `node_modules/next/dist/server/lib/generate-agent-files.js`). Ne vous en servez pas comme
> support de convention et ne vous étonnez pas de le voir réapparaître modifié.
