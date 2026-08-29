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
const CLI = fileURLToPath(new URL('../../tools/agent-journal/cli.mjs', import.meta.url))

let dossier: string
let journal: string

function lancer(...args: string[]): { code: number; sortie: string; erreur: string } {
  const res = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' })
  return { code: res.status ?? -1, sortie: res.stdout ?? '', erreur: res.stderr ?? '' }
}

function ajouter(...args: string[]) {
  return lancer('add', '--journal', journal, ...args)
}

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'summerclub-journal-'))
  journal = join(dossier, 'entries.jsonl')
})

afterEach(() => {
  rmSync(dossier, { recursive: true, force: true })
})

describe('agent-journal — ajout et relecture', () => {
  it('rend exactement ce qui a été écrit, champ par champ', () => {
    // Un résumé qui contient tout ce qui casserait un format naïf : guillemets, saut de
    // ligne, tube de tableau markdown, accents.
    const resume = 'Ligne 1 avec "guillemets"\nLigne 2 | tube — accentué'
    const ajout = ajouter(
      '--task', '12',
      '--role', 'auditor',
      '--model', 'un-modele',
      '--summary', resume,
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
    expect(ajout.code).toBe(0)

    const lu = lancer('list', '--journal', journal, '--json')
    expect(lu.code).toBe(0)
    const entrees = JSON.parse(lu.sortie) as unknown[]
    expect(entrees).toHaveLength(1)
    expect(entrees[0]).toEqual({
      schemaVersion: 1,
      timestamp: '2026-08-29T02:22:10+03:00',
      task: '12',
      role: 'auditor',
      model: 'un-modele',
      summary: resume,
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
    ajouter('--task', '1', '--role', 'developer', '--summary', 'première', '--verdict', 'delivered')
    const apresPremiere = readFileSync(journal, 'utf8')

    ajouter('--task', '2', '--role', 'auditor', '--summary', 'seconde', '--verdict', 'approved')
    const apresSeconde = readFileSync(journal, 'utf8')

    // Append-only : le contenu d'avant est un préfixe exact du contenu d'après.
    expect(apresSeconde.startsWith(apresPremiere)).toBe(true)
    expect(apresSeconde.trimEnd().split('\n')).toHaveLength(2)

    const lu = lancer('list', '--journal', journal, '--json')
    const entrees = JSON.parse(lu.sortie) as { summary: string }[]
    expect(entrees.map((e) => e.summary)).toEqual(['première', 'seconde'])
  })

  it('écrit une entrée par ligne, même avec un résumé multiligne', () => {
    ajouter('--task', '1', '--role', 'developer', '--summary', 'a\nb\nc', '--verdict', 'delivered')
    ajouter('--task', '1', '--role', 'developer', '--summary', 'd', '--verdict', 'delivered')
    expect(readFileSync(journal, 'utf8').trimEnd().split('\n')).toHaveLength(2)
  })
})

describe('agent-journal — refus des entrées fausses', () => {
  it('refuse un rôle inconnu et n\'écrit rien', () => {
    const res = ajouter('--task', '1', '--role', 'stagiaire', '--summary', 'x', '--verdict', 'delivered')
    expect(res.code).toBe(1)
    expect(res.erreur).toContain('stagiaire')
    // Rien n'a été créé : un refus ne laisse pas de trace partielle.
    expect(lancer('list', '--journal', journal).sortie).toContain('Aucune entrée')
  })

  it('refuse un verdict inconnu', () => {
    const res = ajouter('--task', '1', '--role', 'developer', '--summary', 'x', '--verdict', 'peut-etre')
    expect(res.code).toBe(1)
    expect(res.erreur).toContain('peut-etre')
  })

  it('refuse une entrée sans résumé', () => {
    const res = ajouter('--task', '1', '--role', 'developer', '--verdict', 'delivered')
    expect(res.code).toBe(1)
    expect(res.erreur).toContain('summary')
  })

  it('refuse un commit qui n\'en est pas un', () => {
    const res = ajouter(
      '--task', '1', '--role', 'developer', '--summary', 'x',
      '--verdict', 'delivered', '--commit', 'HEAD~1',
    )
    expect(res.code).toBe(1)
    expect(res.erreur).toContain('commit')
  })

  it('refuse un horodatage illisible', () => {
    const res = ajouter(
      '--task', '1', '--role', 'developer', '--summary', 'x',
      '--verdict', 'delivered', '--timestamp', 'hier',
    )
    expect(res.code).toBe(1)
    expect(res.erreur).toContain('hier')
  })
})

describe('agent-journal — un journal abîmé se voit', () => {
  it('échoue en citant la ligne illisible au lieu de la sauter en silence', () => {
    ajouter('--task', '1', '--role', 'developer', '--summary', 'valide', '--verdict', 'delivered')
    appendFileSync(journal, '{ceci n\'est pas du JSON}\n', 'utf8')
    ajouter('--task', '2', '--role', 'developer', '--summary', 'après', '--verdict', 'delivered')

    const res = lancer('list', '--journal', journal)
    expect(res.code).toBe(1)
    expect(res.erreur).toContain('Ligne 2')
    // Le point de ce test : la sortie ne doit surtout pas être « 2 entrées » — ce serait
    // une entrée disparue sans un mot.
    expect(res.sortie).not.toContain('valide')
  })

  it('échoue sur une entrée syntaxiquement valide mais au rôle inventé', () => {
    writeFileSync(
      journal,
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
    const res = lancer('list', '--journal', journal)
    expect(res.code).toBe(1)
    expect(res.erreur).toContain('Ligne 1')
  })

  it('refuse d\'ajouter à la suite d\'une écriture interrompue', () => {
    // Dernière ligne sans saut de ligne final : ajouter derrière fusionnerait les deux
    // entrées en une ligne illisible, donc en perdrait deux.
    ajouter('--task', '1', '--role', 'developer', '--summary', 'valide', '--verdict', 'delivered')
    const contenu = readFileSync(journal, 'utf8')
    writeFileSync(journal, contenu.trimEnd(), 'utf8')

    const res = ajouter('--task', '2', '--role', 'developer', '--summary', 'suite', '--verdict', 'delivered')
    expect(res.code).toBe(1)
    expect(res.erreur).toContain('saut de ligne')
    expect(readFileSync(journal, 'utf8')).toBe(contenu.trimEnd())
  })
})

describe('agent-journal — consultation et récapitulatif', () => {
  beforeEach(() => {
    ajouter('--task', '11', '--role', 'developer', '--summary', 'écrans produits', '--verdict', 'delivered')
    ajouter('--task', '11', '--role', 'auditor', '--summary', 'revue produits', '--verdict', 'changes-requested')
    ajouter('--task', '12', '--role', 'developer', '--summary', 'écrans commandes', '--verdict', 'delivered')
  })

  it('filtre par tâche', () => {
    const res = lancer('list', '--journal', journal, '--task', '11', '--json')
    const entrees = JSON.parse(res.sortie) as { task: string }[]
    expect(entrees).toHaveLength(2)
    expect(entrees.every((e) => e.task === '11')).toBe(true)
  })

  it('filtre par rôle', () => {
    const res = lancer('list', '--journal', journal, '--role', 'developer', '--json')
    const entrees = JSON.parse(res.sortie) as { role: string }[]
    expect(entrees).toHaveLength(2)
    expect(entrees.every((e) => e.role === 'developer')).toBe(true)
  })

  it('croise les deux filtres', () => {
    const res = lancer('list', '--journal', journal, '--task', '11', '--role', 'auditor', '--json')
    const entrees = JSON.parse(res.sortie) as { summary: string }[]
    expect(entrees.map((e) => e.summary)).toEqual(['revue produits'])
  })

  it('engendre un récapitulatif qui contient toutes les entrées', () => {
    const sortie = join(dossier, 'JOURNAL.md')
    const res = lancer('render', '--journal', journal, '--out', sortie)
    expect(res.code).toBe(0)

    const markdown = readFileSync(sortie, 'utf8')
    expect(markdown).toContain('écrans produits')
    expect(markdown).toContain('revue produits')
    expect(markdown).toContain('écrans commandes')
    expect(markdown).toContain('## Tâche 11')
    expect(markdown).toContain('## Tâche 12')
    expect(markdown).toContain('**3 entrées**')
  })

  it('engendre deux fois le même fichier pour les mêmes entrées', () => {
    // Un récapitulatif versionné qui changerait à chaque exécution rendrait son diff muet.
    const premier = join(dossier, 'un.md')
    const second = join(dossier, 'deux.md')
    lancer('render', '--journal', journal, '--out', premier)
    lancer('render', '--journal', journal, '--out', second)
    expect(readFileSync(premier, 'utf8')).toBe(readFileSync(second, 'utf8'))
  })

  it('échappe le tube d\'un constat pour ne pas casser le tableau markdown', () => {
    ajouter(
      '--task', '13', '--role', 'ux-tester', '--summary', 'a | b',
      '--verdict', 'noted', '--important', 'colonne | cassée',
    )
    const sortie = join(dossier, 'JOURNAL.md')
    lancer('render', '--journal', journal, '--out', sortie)
    const markdown = readFileSync(sortie, 'utf8')
    // Dans la ligne du tableau de vue d'ensemble, le tube de la tâche est échappé ;
    // le corps de l'entrée, hors tableau, garde le texte tel quel.
    expect(markdown).toContain('| Date | Tâche | Rôle | Verdict | Commit |')
    expect(markdown).toContain('colonne | cassée')
  })

  it('rend un journal vide sans échouer', () => {
    const vide = join(dossier, 'vide.jsonl')
    const sortie = join(dossier, 'vide.md')
    const res = lancer('render', '--journal', vide, '--out', sortie)
    expect(res.code).toBe(0)
    expect(readFileSync(sortie, 'utf8')).toContain('Aucune entrée')
  })
})
