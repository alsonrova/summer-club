#!/usr/bin/env node
/**
 * Interface en ligne de commande du journal des agents.
 *
 * Couche la plus haute de l'outil : elle lit des arguments, appelle `store.mjs` et
 * `journal.mjs`, et écrit sur la sortie standard. Elle ne contient aucune règle métier —
 * si une décision doit être prise sur le contenu d'une entrée, elle appartient au cœur.
 *
 * Usage : `npm run journal -- <commande> [options]`
 */

import { JournalError, ROLES, VERDICTS, SOURCES, countLabel, filterEntries, normalizeEntry, renderLine, renderMarkdown } from './journal.mjs'
import { appendEntry, defaultJournalPath, defaultSummaryPath, readEntries, writeSummary } from './store.mjs'

/** Options acceptant plusieurs occurrences ; les autres écrasent la précédente. */
const REPEATABLE = new Set(['files', 'critical', 'important', 'minor', 'caveat'])

/** Erreur d'usage : la ligne de commande est fautive, le journal n'est pas en cause. */
class UsageError extends Error {}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      throw new UsageError(`Argument inattendu « ${token} » : les options s'écrivent --nom valeur.`)
    }
    const name = token.slice(2)
    if (name === 'json') {
      options.json = true
      continue
    }
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new UsageError(`L'option --${name} attend une valeur.`)
    }
    index += 1
    if (REPEATABLE.has(name)) {
      options[name] = [...(options[name] ?? []), value]
    } else {
      options[name] = value
    }
  }
  return options
}

const HELP = `Journal des agents — Summer Club

  npm run journal -- add [options]     ajoute une entrée (append-only)
  npm run journal -- list [options]    consulte les entrées, filtrables
  npm run journal -- render [options]  engendre le récapitulatif markdown
  npm run journal -- help              affiche cette aide

Options de « add » :
  --task <id>            tâche concernée (obligatoire, ex. 12)
  --role <rôle>          ${Object.keys(ROLES).join(' | ')} (obligatoire)
  --summary <texte>      ce qui a été fait (obligatoire)
  --verdict <verdict>    ${Object.keys(VERDICTS).join(' | ')} (obligatoire)
  --model <nom>          modèle qui a produit le travail
  --commit <sha>         commit produit (7 à 40 caractères hexadécimaux)
  --tests-before <texte> état des tests avant, ex. « 185 Vitest / 13 Playwright »
  --tests-after <texte>  état des tests après
  --files <chemin>       fichier touché — répétable
  --critical <constat>   constat critique — répétable
  --important <constat>  constat important — répétable
  --minor <constat>      constat mineur — répétable
  --caveat <texte>       réserve, ce qui reste incertain — répétable
  --timestamp <iso>      horodatage (défaut : maintenant)
  --source <source>      ${Object.keys(SOURCES).join(' | ')} (défaut : live)
  --journal <chemin>     fichier de journal (défaut : docs/journal/entries.jsonl)

Options de « list » :
  --task <id>            ne garder que cette tâche
  --role <rôle>          ne garder que ce rôle
  --json                 sortie JSON brute plutôt que texte
  --journal <chemin>     fichier de journal

Options de « render » :
  --journal <chemin>     fichier de journal
  --out <chemin>         récapitulatif à écrire (défaut : docs/journal/JOURNAL.md)

Un champ dont la valeur n'est pas connue reste VIDE. Ne remplissez jamais un chiffre au
jugé : un journal qui invente est pire qu'un journal incomplet.`

function commandAdd(options) {
  const entry = normalizeEntry({
    timestamp: options.timestamp ?? new Date().toISOString(),
    task: options.task,
    role: options.role,
    model: options.model,
    summary: options.summary,
    files: options.files,
    commit: options.commit,
    testsBefore: options['tests-before'],
    testsAfter: options['tests-after'],
    verdict: options.verdict,
    findings: {
      critical: options.critical,
      important: options.important,
      minor: options.minor,
    },
    caveats: options.caveat,
    source: options.source,
  })
  const file = options.journal ?? defaultJournalPath()
  appendEntry(entry, file)

  // L'écriture est faite : on la confirme AVANT toute relecture. Le total ci-dessous relit
  // le fichier entier, et une ligne déjà abîmée — écrite par autre chose que cet outil —
  // ferait échouer cette relecture. L'agent croirait alors que son entrée n'est pas passée,
  // la ressaisirait, et le journal porterait un doublon.
  process.stdout.write(`Entrée ajoutée à ${file}\n${renderLine(entry)}\n`)

  // Le total est un agrément, pas le résultat de la commande : il se tente à part, et son
  // échec s'annonce comme un avertissement, jamais comme un échec d'écriture.
  try {
    process.stdout.write(`${countLabel(readEntries(file).length)} au total.\n`)
  } catch (error) {
    if (!(error instanceof JournalError)) throw error
    process.stderr.write(
      'Avertissement : votre entrée est bien enregistrée, mais le total n\'a pas pu être ' +
        `calculé — ${error.message}\n` +
        'Réparez la ligne citée. Ne ressaisissez pas l\'entrée : elle est déjà dans le ' +
        'fichier.\n',
    )
  }
}

function commandList(options) {
  const file = options.journal ?? defaultJournalPath()
  const entries = filterEntries(readEntries(file), {
    task: options.task,
    role: options.role !== undefined ? checkRole(options.role) : undefined,
  })
  if (options.json === true) {
    process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`)
    return
  }
  if (entries.length === 0) {
    process.stdout.write('Aucune entrée ne correspond.\n')
    return
  }
  for (const entry of entries) {
    process.stdout.write(`${renderLine(entry)}\n`)
  }
  process.stdout.write(`\n${countLabel(entries.length)}.\n`)
}

function checkRole(role) {
  if (!Object.hasOwn(ROLES, role)) {
    throw new JournalError(
      `« ${role} » n'est pas un rôle reconnu. Rôles : ${Object.keys(ROLES).join(', ')}.`,
    )
  }
  return role
}

function commandRender(options) {
  const file = options.journal ?? defaultJournalPath()
  const entries = readEntries(file)
  const out = options.out ?? defaultSummaryPath()
  writeSummary(renderMarkdown(entries), out)
  process.stdout.write(`${out} engendré à partir de ${countLabel(entries.length)}.\n`)
}

function main(argv) {
  const [command, ...rest] = argv
  if (command === undefined || command === 'help' || command === '--help') {
    process.stdout.write(`${HELP}\n`)
    return 0
  }
  const options = parseArgs(rest)
  switch (command) {
    case 'add':
      commandAdd(options)
      return 0
    case 'list':
      commandList(options)
      return 0
    case 'render':
      commandRender(options)
      return 0
    default:
      throw new UsageError(
        `Commande inconnue « ${command} ». Commandes : add, list, render, help.`,
      )
  }
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (error) {
  if (error instanceof JournalError || error instanceof UsageError) {
    process.stderr.write(`Erreur : ${error.message}\n`)
    process.exitCode = 1
  } else {
    throw error
  }
}
