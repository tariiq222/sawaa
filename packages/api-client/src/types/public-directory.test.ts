import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import type { PublicBranch, PublicEmployee } from './public-directory'

/**
 * Drift guard for the hand-written api-client mirror of the public directory
 * routes (MNT-08). `@sawaa/api-client` is NOT generated, so this test reads the
 * committed OpenAPI snapshot and asserts the local interfaces still document
 * exactly the keys the snapshot ships.
 *
 * Keys only. The api-client mirror is deliberately narrower in one place:
 * `PublicEmployee` keeps `gender: string | null` (a free string) rather than the
 * Prisma enum, because mobile/website fixtures pass arbitrary values through.
 * That is a local typing choice, not a wire difference.
 *
 * Optionality is deliberately NOT asserted as equal: the handler always emits
 * every key (null for the nullable ones), so the api-client marks them all
 * required for ergonomics. The test only requires that every key the snapshot
 * marks required is present locally.
 */

type Schemas = Record<string, { required?: string[]; properties?: Record<string, unknown> }>

const spec = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../../apps/backend/openapi.json'), 'utf8'),
) as { components: { schemas: Schemas } }

const schema = (name: string) => {
  const found = spec.components.schemas[name]
  if (!found) throw new Error(`Missing OpenAPI schema ${name}`)
  return found
}

function expectKeysMatch(documented: string[], local: readonly string[]) {
  expect([...local].sort()).toEqual([...documented].sort())
}

describe('api-client public directory mirrors the OpenAPI snapshot', () => {
  it('PublicBranch matches PublicBranchListItemDto', () => {
    const local: (keyof PublicBranch)[] = ['id', 'nameAr', 'nameEn', 'city', 'addressAr', 'isMain']
    expectKeysMatch(Object.keys(schema('PublicBranchListItemDto').properties ?? {}), local)
    expect([...(schema('PublicBranchListItemDto').required ?? [])].sort()).toEqual([...local].sort())
  })

  it('PublicEmployee matches PublicEmployeeProfileDto', () => {
    const local: (keyof PublicEmployee)[] = [
      'id', 'slug', 'nameAr', 'nameEn', 'title', 'specialty', 'specialtyAr',
      'publicBioAr', 'publicBioEn', 'experience', 'languages', 'publicImageUrl',
      'gender', 'employmentType', 'ratingAverage', 'ratingCount', 'minServicePrice',
      'isAvailableToday', 'serviceIds', 'branchIds', 'isBookable',
      'availableDaysOfWeek', 'user', 'rating', 'reviewCount',
    ]
    expectKeysMatch(Object.keys(schema('PublicEmployeeProfileDto').properties ?? {}), local)
    const required = schema('PublicEmployeeProfileDto').required ?? []
    const missing = required.filter((key) => !local.includes(key as keyof PublicEmployee))
    expect(missing, 'documented required keys must exist locally').toEqual([])
  })

  it('the base PublicEmployeeResponseDto is still in the snapshot', () => {
    expect(schema('PublicEmployeeResponseDto')).toBeDefined()
  })
})
