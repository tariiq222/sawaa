import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./check-legacy-multitenant.js", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// The banned tokens are assembled from segments so this regression test can
// never trip the guard it exercises. The guard scans `.js` sources, and adding
// this file to the rule allowlist just to silence itself would weaken the rule.
const ORG_ID_TOKEN = ["X", "Org", "Id"].join("-");
const SMS_TOKEN = ["SMS", "PROVIDER", "PER", "TENANT"].join("_");

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "sawaa-legacy-multitenant-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (relative, content) => {
    const target = join(root, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  const run = () =>
    spawnSync(process.execPath, [script, "--root", root], { cwd: repoRoot, encoding: "utf8" });
  return { root, write, run };
}

test("ignores Agent Teams state and its archive instead of deleting the records", async (t) => {
  const fx = await fixture(t);
  await fx.write(
    ".agent-teams/archive/sanad-safe-cleanup-20260921-b/team.json",
    JSON.stringify({ output: `legacy ${ORG_ID_TOKEN} header`, rule: SMS_TOKEN }),
  );
  await fx.write(
    ".agent-teams/sanad-close-cleanup-remaining-b/team.json",
    JSON.stringify({ task: `${SMS_TOKEN} and ${ORG_ID_TOKEN}` }),
  );

  const result = fx.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed/);
});

test("ignores generated caches (.pnpm-store, .commandcode, .cursor) as output, not source", async (t) => {
  const fx = await fixture(t);
  await fx.write(".pnpm-store/v3/index/aa/bb-index.json", JSON.stringify({ cached: SMS_TOKEN }));
  await fx.write(".commandcode/taste/taste.md", `cached note with ${ORG_ID_TOKEN}`);
  await fx.write(".cursor/rules/deployment-policy.md", `editor state mentioning ${SMS_TOKEN}`);

  const result = fx.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed/);
});

test("still fails on the same tokens inside apps/ and packages/ sources", async (t) => {
  const fx = await fixture(t);
  await fx.write(
    "apps/backend/src/modules/finance/legacy-tenant.ts",
    `const header = "${ORG_ID_TOKEN}";\n`,
  );
  await fx.write(
    "packages/shared/constants/legacy-flags.ts",
    `export const legacyFlag = "${SMS_TOKEN}";\n`,
  );

  const result = fx.run();
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /apps\/backend\/src\/modules\/finance\/legacy-tenant\.ts:1/);
  assert.match(result.stderr, /packages\/shared\/constants\/legacy-flags\.ts:1/);
  assert.ok(result.stderr.includes(ORG_ID_TOKEN), result.stderr);
  assert.ok(result.stderr.includes(SMS_TOKEN), result.stderr);
});

test("still fails in scripts/ and docs/ (no broad directory exclusion)", async (t) => {
  const fx = await fixture(t);
  await fx.write("scripts/another-guard.js", `// forbidden: ${SMS_TOKEN}\n`);
  await fx.write("docs/legacy-cleanup-notes.md", `# history of ${ORG_ID_TOKEN}\n`);

  const result = fx.run();
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /scripts\/another-guard\.js:1/);
  assert.match(result.stderr, /docs\/legacy-cleanup-notes\.md:1/);
});

test("keeps the existing rule allowlist entries unchanged", async (t) => {
  const fx = await fixture(t);
  await fx.write("apps/mobile/services/api.ts", `const header = "${ORG_ID_TOKEN}";\n`);
  await fx.write("apps/mobile/services/api.test.ts", `expect("${ORG_ID_TOKEN}");\n`);
  await fx.write(
    "apps/backend/src/common/guards/jwt.guard.ts",
    `headers["${ORG_ID_TOKEN}"];\n`,
  );
  await fx.write(
    "packages/shared/constants/feature-keys.ts",
    `export const legacy = "${SMS_TOKEN}";\n`,
  );

  const result = fx.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed/);
});

test("passes over the live repository tree, state, and archive", () => {
  const result = spawnSync(process.execPath, [script], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed/);
});

test("rejects a --root flag without a directory instead of scanning the wrong tree", () => {
  const result = spawnSync(process.execPath, [script, "--root"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: node scripts\/check-legacy-multitenant\.js/);
});
