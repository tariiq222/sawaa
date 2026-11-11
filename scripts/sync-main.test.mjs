import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./sync-main.sh', import.meta.url));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = (dir, file, body) => {
  writeFileSync(join(dir, file), body);
  git(dir, 'add', file);
  git(dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', file);
  return git(dir, 'rev-parse', 'HEAD');
};

test('sync fast-forwards main while preserving unrelated local edits and unpublished commits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sawaa-sync-main-'));
  try {
    git(dir, 'init', '--initial-branch=main', 'remote');
    const remote = join(dir, 'remote');
    commit(remote, 'local-edit.txt', 'original');
    git(dir, 'clone', remote, 'checkout');
    const checkout = join(dir, 'checkout');
    writeFileSync(join(checkout, 'local-edit.txt'), 'unsaved');
    const upstream = commit(remote, 'upstream.txt', 'published');
    const sync = () => execFileSync('/bin/bash', [script, checkout], {
      env: { ...process.env, SAWAA_SYNC_STATE_DIR: join(dir, 'state') },
      encoding: 'utf8',
    });
    assert.match(sync(), /fast-forwarded main/);
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), upstream);
    assert.equal(readFileSync(join(checkout, 'local-edit.txt'), 'utf8'), 'unsaved');
    const local = commit(checkout, 'unpublished.txt', 'keep');
    assert.match(sync(), /ahead/);
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), local);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
