#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const baseRef = process.argv[2]

if (!baseRef) {
  console.error('Usage: node scripts/check-prisma-migration-immutability.mjs <base-ref>')
  process.exit(2)
}

const migrationRoot = 'apps/backend/prisma/migrations/'
const output = execFileSync(
  'git',
  ['diff', '--name-status', '--find-renames', `${baseRef}...HEAD`, '--', migrationRoot],
  { encoding: 'utf8' },
)

const violations = output
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter((line) => !line.startsWith('A\t'))

if (violations.length > 0) {
  console.error('Existing Prisma migrations are immutable. Add a new migration instead of modifying, renaming, or deleting one:')
  for (const violation of violations) console.error(`  ${violation}`)
  process.exit(1)
}

console.log('Prisma migration history is immutable relative to the base ref.')
