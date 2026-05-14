/**
 * Fails if any endpoint in openapi.json lacks summary, tags, or error
 * responses, or if any component schema property has neither description
 * nor example.
 *
 * Usage:
 *   cd apps/backend && npm run check:openapi-coverage
 */
import { readFileSync } from 'fs';
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

const specPath = resolve(__dirname, '../openapi.json');
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

if (problems.length > 0) {
  console.error(`✗ OpenAPI coverage check failed — ${problems.length} gap(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

const routeCount = Object.keys(spec.paths ?? {}).length;
console.log(`✓ OpenAPI coverage passes (${routeCount} routes checked)`);
