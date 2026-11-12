#!/usr/bin/env node
/**
 * Backend module-boundary ratchet (MNT-05).
 *
 * Blocks NEW coupling between backend modules. It does not change runtime code
 * and does not judge existing coupling: today's coupling is frozen in
 * scripts/backend-boundaries-baseline.json and may only shrink.
 *
 * What it scans: apps/backend/src/**\/*.ts, excluding *.spec.ts, *.test.ts and
 * __mocks__ directories.
 *
 *  1. Module import edges  - every relative (or "@/") import/export/require
 *     specifier is resolved to a path; when both the importing file and the
 *     target sit in src/modules/<name> with different names it is an edge.
 *     Baseline entry (file level): "import <from> -> <to> (<file>)".
 *  2. Cross-cluster Prisma writes - `(prisma|tx|client|db|trx).<model>.<op>`
 *     with op in create/createMany/createManyAndReturn/update/updateMany/
 *     upsert/delete/deleteMany, in a file under modules/<name>, where the model
 *     is owned by another module. Ownership = the prisma/schema/<file>.prisma
 *     declaring `model X` (file name == module name; organization.prisma is
 *     owned by both org-config and org-experience). Writes to activityLog and
 *     outboxEvent are a shared allowed set: reported, never violations.
 *     Baseline entry (file level): "write <from> -> <owner>.<model> (<file>)".
 *  3. Reverse-layer imports - src/common or src/infrastructure importing
 *     src/modules. Baseline entry: "layer <common|infrastructure> -> modules/<name> (<file>)".
 *
 * Fails when an entry exists that is not in the baseline (new coupling) or a
 * baseline entry no longer exists (stale: refresh with --write-baseline so
 * resolved debt cannot silently return). Mirrors check-openapi-coverage.ts.
 *
 * Limits: regex based, not a TypeScript parser. Writes through aliases
 * (const p = this.prisma; p.booking.update), `$queryRaw`, or dynamically built
 * model names are not seen. Models whose schema file has no matching module
 * (content, main) have no owner, so any module writing them counts as
 * cross-cluster. Path aliases other than "@/" are not resolved.
 *
 * Usage:
 *   node scripts/check-backend-boundaries.mjs [--root <repo>] [--baseline <file>] [--write-baseline]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
function argValue(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(argValue('--root') ?? path.join(scriptDir, '..'))
const baselinePath = path.resolve(argValue('--baseline') ?? path.join(root, 'scripts/backend-boundaries-baseline.json'))
const srcDir = path.join(root, 'apps/backend/src')
const schemaDir = path.join(root, 'apps/backend/prisma/schema')

const WRITE_OPS = ['createManyAndReturn', 'createMany', 'create', 'updateMany', 'update', 'upsert', 'deleteMany', 'delete']
const SHARED_TABLES = new Set(['activityLog', 'outboxEvent'])
const MULTI_OWNER = { organization: ['org-config', 'org-experience'] }

const posix = (p) => p.split(path.sep).join('/')
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1)

function listSourceFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__mocks__' || entry.name === 'node_modules') continue
      out.push(...listSourceFiles(full))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !/\.(spec|test)\.ts$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out.sort()
}

function loadModelOwners() {
  const owners = new Map()
  if (!existsSync(schemaDir)) return owners
  for (const file of readdirSync(schemaDir).filter((f) => f.endsWith('.prisma')).sort()) {
    const base = file.replace(/\.prisma$/, '')
    const ownerList = MULTI_OWNER[base] ?? [base]
    const text = readFileSync(path.join(schemaDir, file), 'utf8')
    for (const match of text.matchAll(/^model\s+(\w+)\s*\{/gm)) owners.set(lowerFirst(match[1]), ownerList)
  }
  return owners
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, '')
}

function importSpecifiers(text) {
  const clean = stripComments(text)
  const found = []
  const patterns = [
    /(?:^|[\n;])\s*(?:import|export)\b[^;'"`]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) for (const m of clean.matchAll(pattern)) found.push(m[1])
  return found
}

function resolveSpecifier(fromFile, spec) {
  if (spec.startsWith('.')) return path.resolve(path.dirname(fromFile), spec)
  if (spec.startsWith('@/')) return path.join(srcDir, spec.slice(2))
  return null
}

function classify(absPath) {
  const rel = posix(path.relative(srcDir, absPath))
  if (rel.startsWith('..')) return { kind: 'outside' }
  const parts = rel.split('/')
  if (parts[0] === 'modules' && parts.length > 1) return { kind: 'module', name: parts[1] }
  if (parts[0] === 'common' || parts[0] === 'infrastructure') return { kind: 'layer', name: parts[0] }
  return { kind: 'other' }
}

function analyze() {
  const owners = loadModelOwners()
  const importEntries = new Set()
  const layerEntries = new Set()
  const writeEntries = new Set()
  const edgeStatements = new Map()
  const edgeFiles = new Map()
  const writeSites = []
  const writeRegex = new RegExp(
    `\\b(?:prisma|tx|client|db|trx)\\s*\\.\\s*(\\w+)\\s*\\.\\s*(${WRITE_OPS.join('|')})\\s*[<(]`,
    'g',
  )

  for (const file of listSourceFiles(srcDir)) {
    const rel = posix(path.relative(root, file))
    const from = classify(file)
    const text = readFileSync(file, 'utf8')

    for (const spec of importSpecifiers(text)) {
      const target = resolveSpecifier(file, spec)
      if (!target) continue
      const to = classify(target)
      if (to.kind !== 'module') continue
      if (from.kind === 'module' && from.name !== to.name) {
        importEntries.add(`import ${from.name} -> ${to.name} (${rel})`)
        const key = `${from.name} -> ${to.name}`
        edgeStatements.set(key, (edgeStatements.get(key) ?? 0) + 1)
        if (!edgeFiles.has(key)) edgeFiles.set(key, new Set())
        edgeFiles.get(key).add(rel)
      } else if (from.kind === 'layer') {
        layerEntries.add(`layer ${from.name} -> modules/${to.name} (${rel})`)
      }
    }

    if (from.kind !== 'module') continue
    for (const match of stripComments(text).matchAll(writeRegex)) {
      const model = match[1]
      const ownerList = owners.get(model)
      if (!ownerList) continue
      if (ownerList.includes(from.name)) continue
      const shared = SHARED_TABLES.has(model)
      writeSites.push({ from: from.name, owners: ownerList, model, shared })
      if (!shared) writeEntries.add(`write ${from.name} -> ${ownerList.join('+')}.${model} (${rel})`)
    }
  }

  const edges = new Set(edgeStatements.keys())
  const bidirectional = [...edges].filter((e) => {
    const [a, b] = e.split(' -> ')
    return a < b && edges.has(`${b} -> ${a}`)
  })

  const entries = [...importEntries, ...layerEntries, ...writeEntries].sort((a, b) => a.localeCompare(b))
  return { entries, edgeStatements, edgeFiles, bidirectional, writeSites }
}

function printSummary({ edgeStatements, edgeFiles, bidirectional, writeSites }, entries) {
  const statements = [...edgeStatements.values()].reduce((a, b) => a + b, 0)
  const importFiles = new Set([...edgeFiles.values()].flatMap((s) => [...s])).size
  const total = writeSites.length
  const opsOwned = writeSites.filter((s) => s.owners.includes('ops')).length
  const sharedCount = writeSites.filter((s) => s.shared).length
  console.log('Backend boundary summary')
  console.log(`  module import edges: ${edgeStatements.size} (${statements} import statements in ${importFiles} files)`)
  console.log(`  bidirectional module pairs: ${bidirectional.length}`)
  console.log(`  reverse-layer import entries: ${entries.filter((e) => e.startsWith('layer ')).length}`)
  console.log(`  cross-cluster Prisma write call sites: ${total}`)
  console.log(`    on ops-owned tables: ${opsOwned} (shared allowed activityLog/outboxEvent: ${sharedCount}, never violations)`)
  console.log(`    excluding ops-owned tables: ${total - opsOwned} (these are the tracked write entries)`)
  console.log(`  baseline-tracked entries: ${entries.length}`)
}

const result = analyze()
const { entries } = result

if (args.includes('--write-baseline')) {
  writeFileSync(baselinePath, `${JSON.stringify(entries, null, 2)}\n`)
  printSummary(result, entries)
  console.log(`Backend boundaries baseline updated with ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}: ${baselinePath}`)
  process.exit(0)
}

let baseline
try {
  const parsed = JSON.parse(readFileSync(baselinePath, 'utf8'))
  if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== 'string')) throw new Error('baseline must be a JSON array of strings')
  baseline = [...new Set(parsed)].sort((a, b) => a.localeCompare(b))
} catch (error) {
  console.error(`✗ Backend boundaries baseline is missing or invalid at ${baselinePath}: ${error instanceof Error ? error.message : String(error)}`)
  console.error('Create it deliberately with: node scripts/check-backend-boundaries.mjs --write-baseline')
  process.exit(1)
}

printSummary(result, entries)
const current = new Set(entries)
const known = new Set(baseline)
const added = entries.filter((e) => !known.has(e))
const stale = baseline.filter((e) => !current.has(e))

if (added.length > 0) {
  console.error(`✗ ${added.length} new backend boundary violation(s) not in the baseline:`)
  for (const entry of added) console.error(`  + ${entry}`)
  console.error('Go through the owning module\'s exported service instead of importing it or writing its tables directly.')
  console.error('If the coupling is deliberate and approved, refresh the baseline with --write-baseline and justify it in review.')
}
if (stale.length > 0) {
  console.error(`✗ Backend boundaries baseline contains ${stale.length} resolved/stale entr${stale.length === 1 ? 'y' : 'ies'}:`)
  for (const entry of stale) console.error(`  - ${entry}`)
  console.error('Refresh the baseline (node scripts/check-backend-boundaries.mjs --write-baseline) so resolved debt cannot silently return.')
}
if (added.length > 0 || stale.length > 0) process.exit(1)

console.log('✓ Backend module boundaries match the baseline.')
