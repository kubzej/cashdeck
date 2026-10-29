import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import * as catalog from './catalog.js'

// catalog.ts is the one place that declares the values the server and the frontend must agree on.
// These checks keep it that way: a list, type or limit copied into another file fails here.

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const catalogFile = path.join(repoRoot, 'server', 'src', 'catalog.ts')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(fullPath)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && fullPath !== catalogFile ? [fullPath] : []
  })
}

const files = [...sourceFiles(path.join(repoRoot, 'server', 'src')), ...sourceFiles(path.join(repoRoot, 'src'))]
  .map((file) => ({ file: path.relative(repoRoot, file), lines: readFileSync(file, 'utf8').split('\n') }))

function find(pattern: RegExp, skipLine: (line: string) => boolean = () => false) {
  return files.flatMap(({ file, lines }) => lines.flatMap((line, index) => pattern.test(line) && !skipLine(line) ? [`${file}:${index + 1}  ${line.trim()}`] : []))
}

const catalogTypeNames = [
  'CategoryDirection', 'CategoryIconKey', 'ColorKey', 'WalletType', 'RecurringRuleKind', 'RecurringFrequency',
  'FeedPeriod', 'FeedItemKind', 'OverviewGranularity', 'OverviewSelectionType',
]

test('no list or limit exported by the catalog is declared again elsewhere', () => {
  const names = Object.keys(catalog)
  const redeclared = find(new RegExp(`\\b(?:const|let|var|function|class)\\s+(?:${names.join('|')})\\b`))
  expect(redeclared).toEqual([])
})

test('no type derived from the catalog is declared by hand elsewhere', () => {
  const redeclared = find(new RegExp(`\\btype\\s+(?:${catalogTypeNames.join('|')})\\s*=`))
  expect(redeclared).toEqual([])
})

test('values the catalog owns are not written out as literal unions', () => {
  // OverviewMode and the cost-summary tone are UI-only unions that merely share two words.
  const isUiOnly = (line: string) => line.includes('OverviewMode') || line.includes('tone:')
  const unions = find(/'income' \| 'expense'|'expense' \| 'income'|'transaction' \| 'transfer'|'day' \| 'month' \| 'quarter'|'week' \| 'month' \| 'year'|'category' \| 'label' \| 'total'/, isUiOnly)
  expect(unions).toEqual([])
})

test('limits owned by the catalog are not repeated as bare numbers', () => {
  expect(find(/maxLength=\{(?:2000|120)\}/)).toEqual([])
  expect(find(/10_000_000_000|10000000000/)).toEqual([])
  expect(find(/\.length\s*>\s*(?:2000|120)\b/)).toEqual([])
})
