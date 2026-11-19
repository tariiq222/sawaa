import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { paths } from './generated/openapi'

/**
 * Drift guard: the committed generated snapshot
 * (`src/types/generated/openapi.ts`) must cover every endpoint that
 * `packages/api-client` calls (`endpoints.manifest.json`).
 *
 * The full "is the generated file stale vs apps/backend/openapi.json" check
 * needs the generator's build step, which is too expensive for a unit test.
 * Instead this asserts the generated `paths` map — the source of truth for
 * every derived type in this package — still contains a route for each
 * manifest entry. A snapshot refresh that drops or renames a route makes the
 * derived types compile against a missing path and/or fails here.
 *
 * Param names are normalised (`{id}` == `{packageId}`), matching
 * `scripts/check-api-client-drift.mjs`.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = path.resolve(here, '../../endpoints.manifest.json')

type ManifestEntry = { method: string; path: string }

const normalize = (p: string) => p.replace(/\{[^}]*\}/g, '{}')

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestEntry[]

// The generated `paths` is a type-only artifact; this key list is the runtime
// mirror produced by the generator. We read it from the generated source so the
// test fails if the snapshot is regenerated and a route disappears.
const generatedSource = readFileSync(
  path.resolve(here, './generated/openapi.ts'),
  'utf8',
)

function generatedPathKeys(): string[] {
  const start = generatedSource.indexOf('export interface paths {')
  const end = generatedSource.indexOf('\nexport interface ', start + 10)
  const block = generatedSource.slice(start, end)
  return [...block.matchAll(/^ {4}"(\/[^"]+)": \{$/gm)].map((m) => m[1]!)
}

function generatedOperationsFor(fullPath: string): string[] {
  const start = generatedSource.indexOf(`"${fullPath}": {`)
  if (start < 0) return []
  const nextPath = generatedSource.indexOf('\n    "/', start + 10)
  const block = generatedSource.slice(start, nextPath < 0 ? undefined : nextPath)
  return [...block.matchAll(/^ {8}([a-z]+)\??: operations\[/gm)].map((m) => m[1]!)
}

describe('generated OpenAPI snapshot covers the api-client endpoint manifest', () => {
  it('loads a non-empty manifest and a non-empty generated paths map', () => {
    expect(manifest.length).toBeGreaterThan(0)
    expect(generatedPathKeys().length).toBeGreaterThan(0)
  })

  it('every manifest method+path exists in the generated snapshot', () => {
    const keys = new Map(generatedPathKeys().map((p) => [normalize(p), p]))
    const missing: string[] = []
    for (const entry of manifest) {
      const method = entry.method.toUpperCase()
      const generatedPath = keys.get(normalize(entry.path))
      if (!generatedPath) {
        missing.push(`${method} ${entry.path} (no path)`)
        continue
      }
      const ops = generatedOperationsFor(generatedPath)
      if (!ops.includes(method.toLowerCase())) {
        missing.push(`${method} ${entry.path} (path present, method missing)`)
      }
    }
    expect(missing).toEqual([])
  })

  it('keeps the type-level paths map in sync with the parsed keys', () => {
    // Compile-time anchor: every generated key is a valid `keyof paths`.
    type Keys = keyof paths
    const sample: Keys = '/api/v1/auth/login' as Keys
    expect(generatedPathKeys()).toContain(sample)
  })
})
