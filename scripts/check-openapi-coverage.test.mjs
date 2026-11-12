import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const checker = path.resolve("apps/backend/scripts/check-openapi-coverage.ts");
const tsxCli = path.resolve("node_modules/tsx/dist/cli.mjs");

function runChecker(specPath, baselinePath) {
  return spawnSync(process.execPath, [tsxCli, checker, "--spec", specPath, "--baseline", baselinePath], {
    encoding: "utf8",
  });
}

const knownProblems = [
  "GET /ok — missing summary",
  "GET /ok — missing tag",
  "GET /ok — no 4xx/5xx response documented",
  "GET /ok — success response has no detailed schema",
  "schema Thing.name — missing description and example",
];

test("OpenAPI coverage gate accepts only the explicitly baselined debt", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sawaa-openapi-coverage-"));
  try {
    const specPath = path.join(tempDir, "openapi.json");
    const baselinePath = path.join(tempDir, "baseline.json");
    await writeFile(specPath, JSON.stringify({
      paths: { "/ok": { get: { responses: { "200": {} } } } },
      components: { schemas: { Thing: { properties: { name: {} } } } },
    }));
    await writeFile(baselinePath, JSON.stringify(knownProblems));

    const result = runChecker(specPath, baselinePath);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /5 known gap\(s\)/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
test("OpenAPI coverage gate rejects a new gap that is absent from the baseline", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sawaa-openapi-coverage-"));
  try {
    const specPath = path.join(tempDir, "openapi.json");
    const baselinePath = path.join(tempDir, "baseline.json");
    await writeFile(specPath, JSON.stringify({
      paths: {
        "/ok": { get: { responses: { "200": {} } } },
        "/new": { post: { summary: "s", tags: ["t"], responses: { "201": {}, "400": {} } } },
      },
      components: { schemas: { Thing: { properties: { name: {} } } } },
    }));
    await writeFile(baselinePath, JSON.stringify(knownProblems));

    const result = runChecker(specPath, baselinePath);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /new gap\(s\)/);
    assert.match(result.stderr, /POST \/new/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

const jsonResponse = (schema) => ({ content: { "application/json": { schema } } });
const documented = (responses) => ({ summary: "s", tags: ["t"], responses: { ...responses, "400": {} } });

async function runWith(paths, baseline) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sawaa-openapi-coverage-"));
  try {
    const specPath = path.join(tempDir, "openapi.json");
    const baselinePath = path.join(tempDir, "baseline.json");
    await writeFile(specPath, JSON.stringify({ paths }));
    await writeFile(baselinePath, JSON.stringify(baseline));
    return runChecker(specPath, baselinePath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("OpenAPI coverage gate rejects a new operation without a detailed success schema", async () => {
  const result = await runWith({ "/x": { get: documented({ "200": jsonResponse({ type: "object" }) }) } }, []);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GET \/x — success response has no detailed schema/);
});

test("OpenAPI coverage gate rejects an operation with no success response", async () => {
  const result = await runWith({ "/x": { get: { summary: "s", tags: ["t"], responses: { "400": {} } } } }, []);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GET \/x — no success response documented/);
});

test("OpenAPI coverage gate accepts $ref, 204-only and non-JSON schema responses", async () => {
  const result = await runWith({
    "/ref": { get: documented({ "200": jsonResponse({ $ref: "#/components/schemas/Thing" }) }) },
    "/none": { delete: documented({ "204": {} }) },
    "/pdf": { get: documented({ "200": { content: { "application/pdf": { schema: { type: "string", format: "binary" } } } } }) },
  }, []);
  assert.equal(result.status, 0, result.stderr);
});

test("OpenAPI coverage gate rejects a stale baseline entry of the success-schema kind", async () => {
  const result = await runWith(
    { "/ref": { get: documented({ "200": jsonResponse({ $ref: "#/components/schemas/Thing" }) }) } },
    ["GET /ref — success response has no detailed schema"],
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /resolved\/stale gap/);
});
