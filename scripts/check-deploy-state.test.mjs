import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./check-deploy-state.mjs", import.meta.url));

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "sawaa-deploy-state-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release@example.invalid");
  git("commit", "--allow-empty", "-m", "base");
  const base = git("rev-parse", "HEAD");
  const check = (target = "main", candidate = "HEAD") => spawnSync(process.execPath, [script, target, candidate], { cwd, encoding: "utf8" });
  const release = () => {
    git("commit", "--allow-empty", "-m", "release");
    git("tag", "-a", "v2026.09.10.1", "-m", "release");
  };
  return { git, base, check, release };
}

test("accepts an initial repository without release tags", (t) => {
  const { check } = fixture(t);
  assert.equal(check().status, 0);
});

test("accepts the exact commit of an annotated release tag", (t) => {
  const { release, check } = fixture(t);
  release();
  assert.equal(check().status, 0);
});

test("accepts a candidate ahead of the latest release", (t) => {
  const { git, release, check } = fixture(t);
  release();
  git("checkout", "-b", "develop");
  git("commit", "--allow-empty", "-m", "candidate");
  assert.equal(check().status, 0);
});

test("rejects a candidate behind the latest release", (t) => {
  const { base, release, check } = fixture(t);
  release();
  const result = check("main", base);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BEHIND/);
});

test("rejects a candidate diverged from the release", (t) => {
  const { git, base, release, check } = fixture(t);
  release();
  git("checkout", "-b", "diverged", base);
  git("commit", "--allow-empty", "-m", "other change");
  assert.equal(check().status, 1);
});

test("rejects an invalid target instead of treating it as an initial release", (t) => {
  const { check } = fixture(t);
  assert.equal(check("missing-branch").status, 1);
});
