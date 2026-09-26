/**
 * Fails if any endpoint in openapi.json lacks summary, tags, or error
 * responses, or if any component schema property has neither description
 * nor example.
 *
 * Usage:
 *   cd apps/backend && npm run check:openapi-coverage
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface OperationObject {
  summary?: string;
  tags?: string[];
  responses?: Record<string, unknown>;
}

interface SchemaProperty {
  description?: string;
  example?: unknown;
  properties?: Record<string, SchemaProperty>;
}

interface OpenApi {
  paths?: Record<string, Record<string, OperationObject>>;
  components?: { schemas?: Record<string, SchemaProperty> };
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const specPath = resolve(argumentValue('--spec') ?? resolve(__dirname, '../openapi.json'));
const baselinePath = resolve(
  argumentValue('--baseline') ?? resolve(__dirname, '../openapi-coverage-baseline.json'),
);
const spec = JSON.parse(readFileSync(specPath, 'utf-8')) as OpenApi;

const problems: string[] = [];
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

for (const [route, methods] of Object.entries(spec.paths ?? {})) {
  for (const [method, op] of Object.entries(methods)) {
    if (!HTTP_METHODS.has(method)) continue;
    const id = `${method.toUpperCase()} ${route}`;
    if (!op.summary) problems.push(`${id} — missing summary`);
    if (!op.tags || op.tags.length === 0) problems.push(`${id} — missing tag`);
    const responses = op.responses ?? {};
    const hasErrorResponse = Object.keys(responses).some(
      (code) => code.startsWith('4') || code.startsWith('5'),
    );
    if (!hasErrorResponse) problems.push(`${id} — no 4xx/5xx response documented`);
  }
}

for (const [schemaName, schema] of Object.entries(spec.components?.schemas ?? {})) {
  for (const [prop, propSchema] of Object.entries(schema.properties ?? {})) {
    if (!propSchema.description && propSchema.example === undefined) {
      problems.push(`schema ${schemaName}.${prop} — missing description and example`);
    }
  }
}

problems.sort((a, b) => a.localeCompare(b));

if (process.argv.includes('--write-baseline')) {
  writeFileSync(baselinePath, `${JSON.stringify(problems, null, 2)}\n`);
  console.log(`OpenAPI coverage baseline updated with ${problems.length} gap(s): ${baselinePath}`);
  process.exit(0);
}

let baseline: string[];
try {
  const parsed = JSON.parse(readFileSync(baselinePath, 'utf-8')) as unknown;
  if (!Array.isArray(parsed) || parsed.some((problem) => typeof problem !== 'string')) {
    throw new Error('baseline must be a JSON array of strings');
  }
  baseline = [...new Set(parsed)].sort((a, b) => a.localeCompare(b));
} catch (error) {
  console.error(
    `✗ OpenAPI coverage baseline is missing or invalid at ${baselinePath}: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

const currentProblems = new Set(problems);
const baselinedProblems = new Set(baseline);
const newProblems = problems.filter((problem) => !baselinedProblems.has(problem));
const staleBaseline = baseline.filter((problem) => !currentProblems.has(problem));

if (newProblems.length > 0) {
  console.error(`✗ OpenAPI coverage check failed — ${newProblems.length} new gap(s):`);
  for (const problem of newProblems) console.error(`  - ${problem}`);
  console.error('Document the new surface, or deliberately refresh the baseline after review.');
  process.exit(1);
}

if (staleBaseline.length > 0) {
  console.error(`✗ OpenAPI coverage baseline contains ${staleBaseline.length} resolved/stale gap(s):`);
  for (const problem of staleBaseline) console.error(`  - ${problem}`);
  console.error('Refresh the baseline so resolved debt cannot be silently reintroduced.');
  process.exit(1);
}

const routeCount = Object.keys(spec.paths ?? {}).length;
console.log(
  `✓ OpenAPI coverage ratchet passes (${routeCount} routes checked, ${problems.length} known gap(s), 0 new)`,
);
