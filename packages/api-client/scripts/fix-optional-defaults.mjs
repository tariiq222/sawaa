#!/usr/bin/env node
/**
 * Post-process the openapi-typescript output.
 *
 * `openapi-typescript` marks a property required when the schema carries a
 * `default`, even though the backend uses `@IsOptional()` + a NestJS default.
 * Verified in this repo: 34 such fields exist (e.g. `CreateServiceDto.currency`,
 * `CreateSessionPackageItemDto.discountValue`). At runtime those keys may be
 * omitted, so the generated type must keep them optional.
 *
 * This script rewrites ONLY those exact properties: `name: T;` -> `name?: T;`.
 * It fails loudly if a listed property is no longer present, so a snapshot
 * refresh can never silently leave the override stale.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , specPathArg, generatedPathArg] = process.argv;
const specPath = resolve(specPathArg);
const generatedPath = resolve(generatedPathArg);

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const schemas = spec.components?.schemas ?? {};

const targets = [];
for (const [schemaName, schema] of Object.entries(schemas)) {
  const required = new Set(schema.required ?? []);
  for (const [prop, propSchema] of Object.entries(schema.properties ?? {})) {
    if (propSchema && Object.prototype.hasOwnProperty.call(propSchema, 'default') && !required.has(prop)) {
      targets.push({ schemaName, prop });
    }
  }
}

let source = readFileSync(generatedPath, 'utf8');
let fixed = 0;
const stale = [];

for (const { schemaName, prop } of targets) {
  const schemaStart = source.indexOf(`        ${schemaName}: {`);
  if (schemaStart < 0) { stale.push(`${schemaName} (schema block missing)`); continue; }
  // The block ends at the next schema key at the same indentation (or EOF).
  const blockEndMatch = new RegExp(`\\n {8}\\w[\\w"]*: \\{`).exec(source.slice(schemaStart + 10));
  const blockEnd = blockEndMatch ? schemaStart + 10 + blockEndMatch.index : source.length;
  const block = source.slice(schemaStart, blockEnd);

  const requiredDecl = new RegExp(`(^|\\n)(\\s+)${prop}: `, 'm');
  const optionalDecl = new RegExp(`(^|\\n)(\\s+)${prop}\\?: `, 'm');
  if (optionalDecl.test(block)) continue; // already optional
  if (!requiredDecl.test(block)) { stale.push(`${schemaName}.${prop} (property missing)`); continue; }

  const rewrittenBlock = block.replace(requiredDecl, `$1$2${prop}?: `);
  source = source.slice(0, schemaStart) + rewrittenBlock + source.slice(blockEnd);
  fixed += 1;
}

if (stale.length > 0) {
  console.error('✗ openapi-typescript defaults post-process: stale overrides');
  for (const s of stale) console.error(`  - ${s}`);
  process.exit(1);
}

writeFileSync(generatedPath, source);
console.log(`openapi-typescript defaults post-process: ${fixed}/${targets.length} optional-defaulted property/properties restored to optional`);
