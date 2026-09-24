#!/usr/bin/env node
// Publishes release metadata only. Never updates a branch or deployment record.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function output(values) {
  const text = Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join('');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
  else process.stdout.write(text);
}
try {
  const [candidate, ...extra] = process.argv.slice(2);
  if (extra.length || !/^[a-f0-9]{40}$/.test(candidate ?? '')) throw new Error('Expected one full commit SHA.');
  if (git('rev-parse', 'HEAD') !== candidate) throw new Error('Checkout does not match the workflow commit.');
  if (git('log', '-1', '--pretty=%s').includes('[skip release]')) {
    output({ skipped: true });
  } else {
    const releasePattern = /^v\d{4}\.\d{2}\.\d{2}\.\d+$/;
    const existing = git('tag', '--points-at', candidate).split('\n').filter(tag => releasePattern.test(tag));
    if (existing.length > 1) throw new Error('Multiple release tags point to this commit; inspect before retrying.');
    let tag = existing[0];
    if (!tag) {
      const base = `v${new Date().toISOString().slice(0, 10).replaceAll('-', '.')}`;
      const numbers = git('tag', '--list', `${base}.*`).split('\n')
        .filter(value => releasePattern.test(value)).map(value => Number(value.split('.').at(-1)));
      tag = `${base}.${Math.max(0, ...numbers) + 1}`;
      git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=github-actions[bot]@users.noreply.github.com',
        'tag', '-a', tag, candidate, '-m', `Release ${tag}; deployment status is recorded separately.`);
    }
    // An explicit tag refspec prevents push.default or branch settings moving main.
    git('push', 'origin', `refs/tags/${tag}:refs/tags/${tag}`);
    output({ skipped: false, tag });
  }
} catch (error) {
  // Git errors can contain remote credentials; only expose controlled messages.
  console.error(error.status === undefined ? error.message : 'Release tag operation failed; inspect Git state before retrying.');
  process.exitCode = 1;
}
