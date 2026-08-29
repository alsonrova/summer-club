/**
 * Cœur du journal des agents : validation, sérialisation, rendu.
 *
 * Ce module ne touche NI au disque NI à l'horloge — il reçoit tout ce dont il a besoin
 * en paramètre. C'est la même règle que `src/domain/` applique au code de l'application
 * (voir docs/CONVENTIONS.md) : ce qui est pur est testable exhaustivement, et un rendu
 * qui ne lit pas l'heure produit deux fois le même fichier pour les mêmes entrées — donc
 * un diff vide quand rien n'a changé.
 *
 * Les identifiants (clés JSON, noms de fonctions, valeurs de rôle et de verdict) sont en
 * anglais ; tout ce qu'un être humain lit — libellés, messages d'erreur, JOURNAL.md — est
 * en français.
 */

/** Version du format d'une entrée. Toute entrée écrite la porte, pour qu'un lecteur futur
 *  sache à quoi il a affaire sans deviner. */
export const SCHEMA_VERSION = 1

/** Rôles d'agent reconnus (voir docs/CONVENTIONS.md § Rôles d'agents). */
export const ROLES = {
  developer: 'Développeur',
  auditor: 'Auditeur qualité et sécurité',
  'ux-tester': 'Testeur UX/UI',
  coordinator: 'Coordinateur',
}

/** Verdicts reconnus. */
export const VERDICTS = {
  delivered: 'livré',
  approved: 'validé',
  'changes-requested': 'correctifs demandés',
  rejected: 'rejeté',
  noted: 'consigné',
}

/** Sévérités de constat, de la plus grave à la plus légère. L'ordre est significatif :
 *  il est celui du rendu. */
export const SEVERITIES = {
  critical: 'Critique',
  important: 'Important',
  minor: 'Mineur',
}

/**
 * Provenance d'une entrée.
 * - `live` : écrite par l'agent au moment où il a fini son travail.
 * - `reconstructed` : reconstituée après coup à partir des commits et des rapports.
 *   Son horodatage est celui d'un commit réel, pas l'heure à laquelle l'agent a travaillé.
 */
export const SOURCES = {
  live: 'consignée sur le moment',
  reconstructed: 'reconstituée a posteriori',
}

/** Ordre des clés à l'écriture. Fixe, pour que deux entrées équivalentes s'écrivent
 *  identiquement et qu'un diff de `entries.jsonl` reste lisible. */
const KEY_ORDER = [
  'schemaVersion',
  'timestamp',
  'task',
  'role',
  'model',
  'summary',
  'files',
  'commit',
  'testsBefore',
  'testsAfter',
  'verdict',
  'findings',
  'caveats',
  'source',
]

/** Erreur de validation ou de lecture du journal. Typée, pour que la CLI distingue une
 *  saisie fautive (message en français, code de sortie 1) d'une panne réelle. */
export class JournalError extends Error {}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new JournalError(`Le champ « ${label} » est obligatoire et ne peut pas être vide.`)
  }
  return value.trim()
}

function optionalString(value, label) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') {
    throw new JournalError(`Le champ « ${label} » doit être une chaîne de caractères.`)
  }
  return value.trim()
}

function stringList(value, label) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    throw new JournalError(`Le champ « ${label} » doit être une liste.`)
  }
  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw new JournalError(`« ${label} »[${index}] doit être une chaîne de caractères.`)
    }
    return item.trim()
  }).filter((item) => item !== '')
}

function checkedKey(value, table, label) {
  const key = requireNonEmptyString(value, label)
  if (!Object.hasOwn(table, key)) {
    throw new JournalError(
      `« ${key} » n'est pas une valeur reconnue pour « ${label} ». ` +
        `Valeurs admises : ${Object.keys(table).join(', ')}.`,
    )
  }
  return key
}

function checkedTimestamp(value) {
  const raw = requireNonEmptyString(value, 'timestamp')
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    throw new JournalError(
      `« ${raw} » n'est pas un horodatage lisible. Attendu : une date ISO 8601, ` +
        'par exemple 2026-08-29T10:12:00+03:00.',
    )
  }
  return raw
}

function checkedCommit(value) {
  const commit = optionalString(value, 'commit')
  if (commit === '') return ''
  if (!/^[0-9a-f]{7,40}$/.test(commit)) {
    throw new JournalError(
      `« ${commit} » ne ressemble pas à un identifiant de commit (7 à 40 caractères ` +
        'hexadécimaux). Laissez le champ vide plutôt que d\'y mettre autre chose.',
    )
  }
  return commit
}

function checkedFindings(value) {
  if (value === undefined || value === null) return { critical: [], important: [], minor: [] }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new JournalError('Le champ « findings » doit être un objet par sévérité.')
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(SEVERITIES, key)) {
      throw new JournalError(
        `« ${key} » n'est pas une sévérité reconnue. ` +
          `Valeurs admises : ${Object.keys(SEVERITIES).join(', ')}.`,
      )
    }
  }
  const findings = {}
  for (const key of Object.keys(SEVERITIES)) {
    findings[key] = stringList(value[key], `findings.${key}`)
  }
  return findings
}

/**
 * Valide une entrée brute et en renvoie une copie normalisée, clés dans l'ordre fixe.
 *
 * Ne remplit AUCUN champ au jugé : un champ inconnu de l'appelant reste vide. Un journal
 * qui invente des chiffres est pire qu'un journal incomplet.
 */
export function normalizeEntry(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new JournalError('Une entrée de journal doit être un objet JSON.')
  }

  const known = new Set(KEY_ORDER)
  for (const key of Object.keys(input)) {
    if (!known.has(key)) {
      throw new JournalError(
        `Champ inconnu « ${key} ». Champs admis : ${KEY_ORDER.join(', ')}.`,
      )
    }
  }

  const schemaVersion = input.schemaVersion ?? SCHEMA_VERSION
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new JournalError('Le champ « schemaVersion » doit être un entier positif.')
  }

  return {
    schemaVersion,
    timestamp: checkedTimestamp(input.timestamp),
    task: requireNonEmptyString(input.task, 'task'),
    role: checkedKey(input.role, ROLES, 'role'),
    model: optionalString(input.model, 'model'),
    summary: requireNonEmptyString(input.summary, 'summary'),
    files: stringList(input.files, 'files'),
    commit: checkedCommit(input.commit),
    testsBefore: optionalString(input.testsBefore, 'testsBefore'),
    testsAfter: optionalString(input.testsAfter, 'testsAfter'),
    verdict: checkedKey(input.verdict, VERDICTS, 'verdict'),
    findings: checkedFindings(input.findings),
    caveats: stringList(input.caveats, 'caveats'),
    source: input.source === undefined || input.source === null
      ? 'live'
      : checkedKey(input.source, SOURCES, 'source'),
  }
}

/**
 * Sérialise une entrée en UNE ligne JSON terminée par un saut de ligne.
 *
 * `JSON.stringify` échappe les sauts de ligne et les guillemets : un résumé multiligne ne
 * peut donc pas casser le format « une entrée par ligne ».
 */
export function serializeEntry(entry) {
  return `${JSON.stringify(normalizeEntry(entry))}\n`
}

/**
 * Relit le contenu brut d'un fichier de journal.
 *
 * Une ligne illisible fait ÉCHOUER la lecture, en citant son numéro. L'alternative —
 * ignorer la ligne et continuer — ferait disparaître une entrée sans le dire, ce qui est
 * exactement ce qu'un journal ne doit jamais faire.
 */
export function parseJournal(text) {
  const entries = []
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '') continue
    let raw
    try {
      raw = JSON.parse(line)
    } catch (cause) {
      throw new JournalError(
        `Ligne ${index + 1} illisible : ce n'est pas du JSON valide (${cause.message}).`,
      )
    }
    try {
      entries.push(normalizeEntry(raw))
    } catch (cause) {
      throw new JournalError(`Ligne ${index + 1} invalide : ${cause.message}`)
    }
  }
  return entries
}

/** Filtre par tâche et/ou par rôle. Un critère absent ne filtre rien. */
export function filterEntries(entries, { task, role } = {}) {
  return entries.filter((entry) => {
    if (task !== undefined && task !== null && entry.task !== task) return false
    if (role !== undefined && role !== null && entry.role !== role) return false
    return true
  })
}

/** Date seule, telle qu'écrite dans l'horodatage : on n'applique aucun fuseau, donc on ne
 *  fait pas glisser une entrée d'un jour en la relisant ailleurs. */
function dateOf(timestamp) {
  return timestamp.slice(0, 10)
}

/** Échappe ce qui casserait une cellule de tableau markdown. */
function escapeCell(text) {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function formatTests(entry) {
  if (entry.testsBefore === '' && entry.testsAfter === '') return ''
  return `${entry.testsBefore || '—'} → ${entry.testsAfter || '—'}`
}

/**
 * Engendre le récapitulatif markdown.
 *
 * Fonction pure : mêmes entrées, même sortie, à la virgule près. Aucun horodatage de
 * génération n'y figure — sinon le fichier versionné changerait à chaque exécution et son
 * diff ne dirait plus rien.
 */
export function renderMarkdown(entries) {
  const lines = []
  lines.push('# Journal des agents — Summer Club')
  lines.push('')
  lines.push('<!-- Fichier ENGENDRÉ par `npm run journal:render`. Ne pas le modifier à la')
  lines.push('     main : la source de vérité est docs/journal/entries.jsonl. -->')
  lines.push('')
  lines.push(
    'Ce document recense ce que chaque agent d\'intelligence artificielle a fait sur ce ' +
      'dépôt : ce qu\'il a produit, ce qu\'il a vérifié, ce qu\'il a trouvé et ce qu\'il ' +
      'laisse en suspens. Mode d\'emploi : `docs/journal/README.md`.',
  )
  lines.push('')

  if (entries.length === 0) {
    lines.push('_Aucune entrée pour l\'instant._')
    lines.push('')
    return lines.join('\n')
  }

  const byRole = new Map()
  for (const entry of entries) {
    byRole.set(entry.role, (byRole.get(entry.role) ?? 0) + 1)
  }
  const roleCounts = Object.keys(ROLES)
    .filter((role) => byRole.has(role))
    .map((role) => `${ROLES[role]} ${byRole.get(role)}`)
    .join(' · ')

  const tasks = []
  for (const entry of entries) {
    if (!tasks.includes(entry.task)) tasks.push(entry.task)
  }

  lines.push(
    `**${countLabel(entries.length)}** · ${tasks.length} tâches · ${roleCounts}`,
  )
  lines.push('')
  lines.push('## Vue d\'ensemble')
  lines.push('')
  lines.push('| Date | Tâche | Rôle | Verdict | Commit |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const entry of entries) {
    lines.push(
      `| ${dateOf(entry.timestamp)} | ${escapeCell(entry.task)} | ${ROLES[entry.role]} ` +
        `| ${VERDICTS[entry.verdict]} | ${entry.commit ? `\`${entry.commit}\`` : '—'} |`,
    )
  }
  lines.push('')

  for (const task of tasks) {
    lines.push(`## Tâche ${task}`)
    lines.push('')
    for (const entry of filterEntries(entries, { task })) {
      lines.push(
        `### ${dateOf(entry.timestamp)} · ${ROLES[entry.role]} — ${VERDICTS[entry.verdict]}`,
      )
      lines.push('')
      lines.push(entry.summary)
      lines.push('')
      if (entry.model !== '') lines.push(`- **Modèle** : ${entry.model}`)
      if (entry.commit !== '') lines.push(`- **Commit** : \`${entry.commit}\``)
      const tests = formatTests(entry)
      if (tests !== '') lines.push(`- **Tests** : ${tests}`)
      if (entry.files.length > 0) {
        lines.push(`- **Fichiers** : ${entry.files.map((f) => `\`${f}\``).join(', ')}`)
      }
      for (const severity of Object.keys(SEVERITIES)) {
        for (const finding of entry.findings[severity]) {
          lines.push(`- **${SEVERITIES[severity]}** : ${finding}`)
        }
      }
      for (const caveat of entry.caveats) {
        lines.push(`- **Réserve** : ${caveat}`)
      }
      if (entry.source !== 'live') {
        lines.push(`- _Entrée ${SOURCES[entry.source]} — horodatage calé sur un commit._`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/** « 0 entrée », « 1 entrée », « 2 entrées » — l'accord se fait à partir de deux en
 *  français. */
export function countLabel(count) {
  return count > 1 ? `${count} entrées` : `${count} entrée`
}

/** Rendu d'une entrée pour la sortie texte de `list`. */
export function renderLine(entry) {
  const parts = [
    dateOf(entry.timestamp),
    `tâche ${entry.task}`,
    ROLES[entry.role],
    VERDICTS[entry.verdict],
  ]
  if (entry.commit !== '') parts.push(entry.commit)
  return `${parts.join(' · ')}\n    ${entry.summary}`
}
