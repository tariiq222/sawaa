import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const script = fileURLToPath(new URL('./tag-release.mjs', import.meta.url));
function fixture(t, subject = 'approved release') {
  const root = mkdtempSync(join(tmpdir(), 'sawaa-tag-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'source'), remote = join(root, 'remote.git');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
  execFileSync('git', ['init', '-b', 'main', cwd], { stdio: 'ignore' });
  git('config', 'user.name', 'Release test'); git('config', 'user.email', 'test@example.invalid');
  writeFileSync(join(cwd, 'deployment.json'), 'unchanged evidence\n');
  git('add', '.'); git('commit', '-m', subject); git('remote', 'add', 'origin', remote); git('push', 'origin', 'main');
  const sha = git('rev-parse', 'HEAD'), output = join(root, 'output');
  const run = (candidate = sha) => {
    writeFileSync(output, '');
    const result = spawnSync(process.execPath, [script, candidate], { cwd, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output } });
    return { ...result, output: readFileSync(output, 'utf8') };
  };
  return { git, sha, run, cwd };
}
test('publishes only an annotated tag, preserving main and deployment evidence', t => {
  const { git, sha, run, cwd } = fixture(t);
  const r = run(); assert.equal(r.status, 0, r.stderr);
  const name = r.output.match(/^tag=(v\d{4}\.\d{2}\.\d{2}\.\d+)$/m)?.[1];
  assert.ok(name); assert.equal(git('cat-file', '-t', name), 'tag');
  assert.equal(git('rev-parse', `${name}^{commit}`), sha);
  assert.equal(git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0], sha);
  assert.ok(git('ls-remote', 'origin', `refs/tags/${name}`));
  assert.equal(readFileSync(join(cwd, 'deployment.json'), 'utf8'), 'unchanged evidence\n');
  assert.equal(git('status', '--porcelain'), '');
});
test('a retry reuses the same published tag without another release number', t => {
  const { git, run } = fixture(t); const first = run(); assert.equal(first.status, 0, first.stderr);
  const second = run(); assert.equal(second.status, 0, second.stderr);
  assert.equal(second.output, first.output); assert.equal(git('tag', '--list').split('\n').length, 1);
});
test('skip release does not publish tags or move main', t => {
  const { git, sha, run } = fixture(t, 'docs [skip release]');
  const r = run(); assert.equal(r.status, 0, r.stderr); assert.match(r.output, /skipped=true/);
  assert.equal(git('ls-remote', 'origin', 'refs/tags/*'), '');
  assert.equal(git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0], sha);
});
test('refuses to tag a checkout that differs from the workflow commit', t => {
  const { git, run } = fixture(t); const r = run('a'.repeat(40));
  assert.notEqual(r.status, 0); assert.equal(git('ls-remote', 'origin', 'refs/tags/*'), '');
});
test('increments same-day release numbers and ignores rollback tags', t => {
  const { git, sha, run } = fixture(t);
  const date = new Date().toISOString().slice(0,10).replaceAll('-', '.');
  git('tag', '-a', `v${date}.9`, '-m', 'earlier');
  git('tag', '-a', 'rollback/old', '-m', 'rollback');
  git('commit', '--allow-empty', '-m', 'next');
  const r = run(git('rev-parse', 'HEAD')); assert.equal(r.status, 0, r.stderr);
  assert.match(r.output, new RegExp(`tag=v${date.replaceAll('.', '\\.')}.10`));
  assert.equal(git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0], sha);
});
