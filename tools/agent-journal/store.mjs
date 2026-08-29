/**
 * Accès disque du journal des agents — la seule couche de cet outil qui touche au système
 * de fichiers. `journal.mjs` (le cœur) n'en sait rien ; `cli.mjs` (l'interface) ne fait
 * que l'appeler.
 *
 * Le stockage est APPEND-ONLY : `appendEntry` n'ouvre jamais le fichier en écriture, il
 * n'y ajoute qu'à la fin. Corriger une entrée passée se fait en en ajoutant une nouvelle
 * qui la rectifie, jamais en réécrivant l'ancienne — c'est ce qui rend le journal
 * opposable, et c'est le même principe que le journal d'audit de l'application
 * (`src/server/audit.ts`).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { JournalError, parseJournal, serializeEntry } from './journal.mjs'

/** Racine du dépôt, déduite de l'emplacement de ce fichier (tools/agent-journal/). Aucune
 *  dépendance au répertoire courant : l'outil marche quel que soit l'endroit d'où on
 *  l'appelle. */
export function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

/** Fichier de journal par défaut. Versionné par git, contrairement à `.superpowers/`. */
export function defaultJournalPath() {
  return resolve(repoRoot(), 'docs', 'journal', 'entries.jsonl')
}

/** Récapitulatif markdown par défaut, engendré à partir du fichier ci-dessus. */
export function defaultSummaryPath() {
  return resolve(repoRoot(), 'docs', 'journal', 'JOURNAL.md')
}

/** Dernier octet du fichier, sans le charger en mémoire. */
function lastByte(file) {
  const size = statSync(file).size
  if (size === 0) return null
  const fd = openSync(file, 'r')
  try {
    const buffer = Buffer.alloc(1)
    readSync(fd, buffer, 0, 1, size - 1)
    return buffer[0]
  } finally {
    closeSync(fd)
  }
}

/** Lit toutes les entrées. Un fichier absent vaut journal vide — pas une erreur. */
export function readEntries(file = defaultJournalPath()) {
  if (!existsSync(file)) return []
  return parseJournal(readFileSync(file, 'utf8'))
}

/**
 * Ajoute une entrée à la fin du fichier, après l'avoir validée.
 *
 * Refuse d'écrire si le fichier ne se termine pas par un saut de ligne : cela signale une
 * écriture précédente interrompue, et ajouter à la suite fusionnerait deux entrées en une
 * ligne illisible — donc perdrait les deux. Mieux vaut s'arrêter en le disant.
 */
export function appendEntry(entry, file = defaultJournalPath()) {
  const line = serializeEntry(entry)
  mkdirSync(dirname(file), { recursive: true })
  if (existsSync(file) && lastByte(file) !== null && lastByte(file) !== 0x0a) {
    throw new JournalError(
      `${file} ne se termine pas par un saut de ligne : sa dernière écriture a été ` +
        'interrompue. Réparez la dernière ligne à la main avant d\'ajouter une entrée.',
    )
  }
  appendFileSync(file, line, 'utf8')
  return line
}

/** Écrit le récapitulatif markdown. Seul fichier que cet outil réécrit — c'est une sortie
 *  engendrée, pas une source. */
export function writeSummary(markdown, file = defaultSummaryPath()) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, markdown, 'utf8')
  return file
}
