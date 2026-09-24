#!/usr/bin/env node
// scripts/check-deploy-state.mjs
//
// Verifies that the candidate commit (default HEAD) is at-or-after the
// most recent tagged code release on the target branch (default origin/main). This checks Git ancestry only, not deployment or merge approval.
//
// Catches the class of bug where develop was force-pushed or someone
// retargeted a stale PR — the merge target would otherwise be considered
// "ahead" of the last deployed commit, but in reality it might be missing
// hotfixes that shipped to main.
//
// Usage:
//   node scripts/check-deploy-state.mjs [target-branch] [candidate]
//
// Exit code 0 = candidate is at-or-after latest release (PASS)
// Exit code 1 = candidate is behind (FAIL — do NOT merge)

import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fail(msg) {
  console.error(`❌ check-deploy-state: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ check-deploy-state: ${msg}`);
}

const targetBranch = process.argv[2] || "origin/main";
const candidate = process.argv[3] || "HEAD";

let targetCommit;
let candidateCommit;
try {
  targetCommit = git("rev-parse", "--verify", "--end-of-options", `${targetBranch}^{commit}`);
  candidateCommit = git("rev-parse", "--verify", "--end-of-options", `${candidate}^{commit}`);
} catch {
  fail("Target branch and candidate must both resolve to existing commits.");
}

let latestRelease;
try {
  // Git --match is a glob, not a regex; filter exact CalVer names first.
  const tags = git("tag", "--merged", targetCommit).split("\n")
    .filter(tag => /^v\d{4}\.\d{2}\.\d{2}\.\d+$/.test(tag));
  if (tags.length === 0) {
    ok(`No code-release tags on ${targetBranch} — ancestry check skipped; deployment remains unverified.`);
    process.exit(0);
  }
  latestRelease = git("describe", "--tags", "--abbrev=0",
    ...tags.flatMap(tag => ["--match", tag]), targetCommit);
} catch {
  fail("Unable to resolve code-release ancestry; inspect Git state.");
}

console.log(`  target branch : ${targetBranch}`);
console.log(`  latest release: ${latestRelease}`);
console.log(`  candidate     : ${candidate}`);

// Is the candidate reachable FROM the latest release?
// merge-base computes the best common ancestor. If the merge-base
// equals the latest release commit, the candidate is at-or-after.
let mergeBase;
let releaseCommit;
try {
  releaseCommit = git("rev-parse", "--verify", "--end-of-options", `${latestRelease}^{commit}`);
  mergeBase = git("merge-base", releaseCommit, candidateCommit);
} catch (e) {
  fail(
    `No common ancestor between ${latestRelease} and ${candidate}. ` +
      `This usually means develop was force-pushed or the PR is ` +
      `cherry-picked from a divergent branch. Investigate before merging.`,
  );
}

if (mergeBase === releaseCommit) {
  ok(
    `${candidate} is at-or-after ${latestRelease} — merge target is ` +
      `valid by tagged code-release ancestry only; deployment and approval remain separate.`,
  );
  process.exit(0);
}

if (mergeBase === candidateCommit) {
  fail(
    `${candidate} is the merge-base — it is BEHIND ${latestRelease}. ` +
      `Rebase onto current main or pull the latest main into this branch ` +
      `before merging.`,
  );
}

fail(
  `${candidate} and ${latestRelease} diverged at ${mergeBase}. ` +
    `Either rebase the candidate or fast-forward main to ${candidate} ` +
    `only through the approved release policy.`,
);
