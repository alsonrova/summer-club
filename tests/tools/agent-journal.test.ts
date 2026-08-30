import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// L'outil de journal vit dans tools/, hors de src/ : il n'entre pas dans le build de
// l'application et n'est pas analysé par le tsconfig de production (fichiers .mjs, absents
// des motifs `include`). On l'exerce donc comme la personne qui s'en sert : en lançant la
// vraie CLI dans un sous-processus, sur un fichier de journal jetable. Ce test vérifie
// exactement ce que le journal promet — ne perdre aucune entrée, n'en écrire aucune de
// fausse — plutôt que les détails internes de ses fonctions.
//
// Les identifiants sont en anglais et les libellés de test en français : c'est la règle du
// dépôt (docs/CONVENTIONS.md § 1).
const CLI = fileURLToPath(new URL('../../tools/agent-journal/cli.mjs', import.meta.url))

let directory: string
let journalFile: string

function run(...args: string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' })
  return { code: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function add(...args: string[]) {
  return run('add', '--journal', journalFile, ...args)
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'summerclub-journal-'))
  journalFile = join(directory, 'entries.jsonl')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe('agent-journal — ajout et relecture', () => {
  it('rend exactement ce qui a été écrit, champ par champ', () => {
    // Un résumé qui contient tout ce qui casserait un format naïf : guillemets, saut de
    // ligne, tube de tableau markdown, accents.
    const summary = 'Ligne 1 avec "guillemets"\nLigne 2 | tube — accentué'
    const added = add(
      '--task', '12',
      '--role', 'auditor',
      '--model', 'un-modele',
      '--summary', summary,
      '--verdict', 'changes-requested',
      '--commit', 'bbaa4a9',
      '--tests-before', '185 Vitest / 13 Playwright',
      '--tests-after', '222 Vitest / 13 Playwright',
      '--files', 'src/server/order-status-service.ts',
      '--files', 'tests/server/statut.test.ts',
      '--critical', 'un constat critique',
      '--important', 'un constat important',
      '--minor', 'un constat mineur',
      '--caveat', 'une réserve ouverte',
      '--timestamp', '2026-08-29T02:22:10+03:00',
    )
    expect(added.code).toBe(0)

    const listed = run('list', '--journal', journalFile, '--json')
    expect(listed.code).toBe(0)
    const entries = JSON.parse(listed.stdout) as unknown[]
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({
      schemaVersion: 1,
      timestamp: '2026-08-29T02:22:10+03:00',
      task: '12',
      role: 'auditor',
      model: 'un-modele',
      summary,
      files: ['src/server/order-status-service.ts', 'tests/server/statut.test.ts'],
      commit: 'bbaa4a9',
      testsBefore: '185 Vitest / 13 Playwright',
      testsAfter: '222 Vitest / 13 Playwright',
      verdict: 'changes-requested',
      findings: {
        critical: ['un constat critique'],
        important: ['un constat important'],
        minor: ['un constat mineur'],
      },
      caveats: ['une réserve ouverte'],
      source: 'live',
    })
  })

  it('ajoute à la fin sans toucher aux entrées déjà écrites', () => {
    add('--task', '1', '--role', 'developer', '--summary', 'première', '--verdict', 'delivered')
    const afterFirst = readFileSync(journalFile, 'utf8')

    add('--task', '2', '--role', 'auditor', '--summary', 'seconde', '--verdict', 'approved')
    const afterSecond = readFileSync(journalFile, 'utf8')

    // Append-only : le contenu d'avant est un préfixe exact du contenu d'après.
    expect(afterSecond.startsWith(afterFirst)).toBe(true)
    expect(afterSecond.trimEnd().split('\n')).toHaveLength(2)

    const listed = run('list', '--journal', journalFile, '--json')
    const entries = JSON.parse(listed.stdout) as { summary: string }[]
    expect(entries.map((entry) => entry.summary)).toEqual(['première', 'seconde'])
  })

  it('écrit une entrée par ligne, même avec un résumé multiligne', () => {
    add('--task', '1', '--role', 'developer', '--summary', 'a\nb\nc', '--verdict', 'delivered')
    add('--task', '1', '--role', 'developer', '--summary', 'd', '--verdict', 'delivered')
    expect(readFileSync(journalFile, 'utf8').trimEnd().split('\n')).toHaveLength(2)
  })
})

describe('agent-journal — refus des entrées fausses', () => {
  it('refuse un rôle inconnu et n\'écrit rien', () => {
    const result = add('--task', '1', '--role', 'stagiaire', '--summary', 'x', '--verdict', 'delivered')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('stagiaire')
    // Rien n'a été créé : un refus ne laisse pas de trace partielle.
    expect(run('list', '--journal', journalFile).stdout).toContain('Aucune entrée')
  })

  it('refuse un verdict inconnu', () => {
    const result = add('--task', '1', '--role', 'developer', '--summary', 'x', '--verdict', 'peut-etre')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('peut-etre')
  })

  it('refuse une entrée sans résumé', () => {
    const result = add('--task', '1', '--role', 'developer', '--verdict', 'delivered')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('summary')
  })

  it('refuse un commit qui n\'en est pas un', () => {
    const result = add(
      '--task', '1', '--role', 'developer', '--summary', 'x',
      '--verdict', 'delivered', '--commit', 'HEAD~1',
    )
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('commit')
  })

  it('refuse un horodatage illisible', () => {
    const result = add(
      '--task', '1', '--role', 'developer', '--summary', 'x',
      '--verdict', 'delivered', '--timestamp', 'hier',
    )
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('hier')
  })
})

describe('agent-journal — un journal abîmé se voit', () => {
  it('échoue en citant la ligne illisible au lieu de la sauter en silence', () => {
    add('--task', '1', '--role', 'developer', '--summary', 'valide', '--verdict', 'delivered')
    appendFileSync(journalFile, '{ceci n\'est pas du JSON}\n', 'utf8')
    add('--task', '2', '--role', 'developer', '--summary', 'après', '--verdict', 'delivered')

    const result = run('list', '--journal', journalFile)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Ligne 2')
    // Le point de ce test : la sortie ne doit surtout pas être « 2 entrées » — ce serait
    // une entrée disparue sans un mot.
    expect(result.stdout).not.toContain('valide')
  })

  it('échoue sur une entrée syntaxiquement valide mais au rôle inventé', () => {
    writeFileSync(
      journalFile,
      `${JSON.stringify({
        schemaVersion: 1,
        timestamp: '2026-08-29T00:00:00+03:00',
        task: '1',
        role: 'oracle',
        summary: 'x',
        verdict: 'delivered',
      })}\n`,
      'utf8',
    )
    const result = run('list', '--journal', journalFile)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Ligne 1')
  })

  it('confirme l\'écriture même quand une ligne déjà présente est illisible', () => {
    // Le total affiché par « add » relit tout le fichier. Si le journal porte déjà une
    // ligne abîmée, cette relecture lève — et l'agent voit une erreur alors que son entrée
    // EST enregistrée. Il la ressaisit, et le journal double. L'écriture se confirme donc
    // avant, et le total se tente après, en avertissement séparé.
    add('--task', '1', '--role', 'developer', '--summary', 'avant la casse', '--verdict', 'delivered')
    appendFileSync(journalFile, '{ceci n\'est pas du JSON}\n', 'utf8')

    const result = add(
      '--task', '2', '--role', 'developer', '--summary', 'après la casse', '--verdict', 'delivered',
    )

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Entrée ajoutée')
    expect(result.stdout).toContain('après la casse')
    // Le total n'a pas pu être calculé : un avertissement qui dit explicitement que
    // l'entrée est enregistrée, pas un échec d'écriture.
    expect(result.stdout).not.toContain('au total')
    expect(result.stderr).toContain('Avertissement')
    expect(result.stderr).toContain('est bien enregistrée')
    expect(result.stderr).toContain('Ligne 2')

    // Et elle est dans le fichier, une seule fois.
    const lines = readFileSync(journalFile, 'utf8').trimEnd().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines.filter((line) => line.includes('après la casse'))).toHaveLength(1)
  })

  it('refuse une entrée écrite par une version plus récente de l\'outil', () => {
    // Sans ce garde, une entrée de format 2 serait relue avec les règles de la version 1,
    // donc mal comprise en silence. Le champ schemaVersion n'aurait alors rien apporté.
    writeFileSync(
      journalFile,
      `${JSON.stringify({
        schemaVersion: 2,
        timestamp: '2026-08-29T00:00:00+03:00',
        task: '1',
        role: 'developer',
        summary: 'venue du futur',
        verdict: 'delivered',
      })}\n`,
      'utf8',
    )
    const result = run('list', '--journal', journalFile)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Ligne 1')
    expect(result.stderr).toContain('schemaVersion')
    expect(result.stdout).not.toContain('venue du futur')
  })

  it('refuse d\'ajouter à la suite d\'une écriture interrompue', () => {
    // Dernière ligne sans saut de ligne final : ajouter derrière fusionnerait les deux
    // entrées en une ligne illisible, donc en perdrait deux.
    add('--task', '1', '--role', 'developer', '--summary', 'valide', '--verdict', 'delivered')
    const content = readFileSync(journalFile, 'utf8')
    writeFileSync(journalFile, content.trimEnd(), 'utf8')

    const result = add('--task', '2', '--role', 'developer', '--summary', 'suite', '--verdict', 'delivered')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('saut de ligne')
    expect(readFileSync(journalFile, 'utf8')).toBe(content.trimEnd())
  })
})

describe('agent-journal — consultation et récapitulatif', () => {
  beforeEach(() => {
    add('--task', '11', '--role', 'developer', '--summary', 'écrans produits', '--verdict', 'delivered')
    add('--task', '11', '--role', 'auditor', '--summary', 'revue produits', '--verdict', 'changes-requested')
    add('--task', '12', '--role', 'developer', '--summary', 'écrans commandes', '--verdict', 'delivered')
  })

  it('filtre par tâche', () => {
    const result = run('list', '--journal', journalFile, '--task', '11', '--json')
    const entries = JSON.parse(result.stdout) as { task: string }[]
    expect(entries).toHaveLength(2)
    expect(entries.every((entry) => entry.task === '11')).toBe(true)
  })

  it('filtre par rôle', () => {
    const result = run('list', '--journal', journalFile, '--role', 'developer', '--json')
    const entries = JSON.parse(result.stdout) as { role: string }[]
    expect(entries).toHaveLength(2)
    expect(entries.every((entry) => entry.role === 'developer')).toBe(true)
  })

  it('croise les deux filtres', () => {
    const result = run('list', '--journal', journalFile, '--task', '11', '--role', 'auditor', '--json')
    const entries = JSON.parse(result.stdout) as { summary: string }[]
    expect(entries.map((entry) => entry.summary)).toEqual(['revue produits'])
  })

  it('engendre un récapitulatif qui contient toutes les entrées', () => {
    const outPath = join(directory, 'JOURNAL.md')
    const result = run('render', '--journal', journalFile, '--out', outPath)
    expect(result.code).toBe(0)

    const markdown = readFileSync(outPath, 'utf8')
    expect(markdown).toContain('écrans produits')
    expect(markdown).toContain('revue produits')
    expect(markdown).toContain('écrans commandes')
    expect(markdown).toContain('## Tâche 11')
    expect(markdown).toContain('## Tâche 12')
    expect(markdown).toContain('**3 entrées**')
  })

  it('engendre deux fois le même fichier pour les mêmes entrées', () => {
    // Un récapitulatif versionné qui changerait à chaque exécution rendrait son diff muet.
    const first = join(directory, 'un.md')
    const second = join(directory, 'deux.md')
    run('render', '--journal', journalFile, '--out', first)
    run('render', '--journal', journalFile, '--out', second)
    expect(readFileSync(first, 'utf8')).toBe(readFileSync(second, 'utf8'))
  })

  // La cellule de tâche est la seule valeur libre qui entre dans le tableau de vue
  // d'ensemble. Les deux tests qui suivent l'assèrent sur la ligne ENTIÈRE : un tube ou un
  // saut de ligne non traité y ajouterait une colonne ou couperait la ligne en deux, et
  // décalerait tout le tableau. Une assertion `toContain` sur l'en-tête ou sur le corps de
  // l'entrée ne protégerait rien — elle passe même sans échappement.
  function overviewRows(markdown: string): string[] {
    return markdown.split('\n').filter((line) => line.startsWith('| 2026-08-29 |'))
  }

  it('échappe le tube d\'une tâche pour ne pas ajouter une colonne au tableau', () => {
    add(
      '--task', 'a | b', '--role', 'ux-tester', '--summary', 'résumé',
      '--verdict', 'noted', '--important', 'colonne | cassée',
      '--timestamp', '2026-08-29T02:22:10+03:00',
    )
    const outPath = join(directory, 'JOURNAL.md')
    run('render', '--journal', journalFile, '--out', outPath)
    const markdown = readFileSync(outPath, 'utf8')

    expect(overviewRows(markdown)).toEqual([
      '| 2026-08-29 | a \\| b | Testeur UX/UI | consigné | — |',
    ])
    // Hors du tableau, le corps de l'entrée garde le texte tel quel : l'échappement est
    // une contrainte du tableau, pas une réécriture du contenu.
    expect(markdown).toContain('colonne | cassée')
  })

  it('aplatit le saut de ligne d\'une tâche pour ne pas couper la ligne du tableau', () => {
    add(
      '--task', 'a\nb', '--role', 'ux-tester', '--summary', 'résumé',
      '--verdict', 'noted', '--timestamp', '2026-08-29T02:22:10+03:00',
    )
    const outPath = join(directory, 'JOURNAL.md')
    run('render', '--journal', journalFile, '--out', outPath)

    expect(overviewRows(readFileSync(outPath, 'utf8'))).toEqual([
      '| 2026-08-29 | a b | Testeur UX/UI | consigné | — |',
    ])
  })

  it('rend un journal vide sans échouer', () => {
    const emptyJournal = join(directory, 'vide.jsonl')
    const outPath = join(directory, 'vide.md')
    const result = run('render', '--journal', emptyJournal, '--out', outPath)
    expect(result.code).toBe(0)
    expect(readFileSync(outPath, 'utf8')).toContain('Aucune entrée')
  })
})
