import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The coverage checker is a ratchet: it must accept an endpoint whose documented
 * success IS a redirect, and still reject one with no success response at all.
 */
const SCRIPT = join(__dirname, 'check-openapi-coverage.ts');

function run(spec: unknown): { status: number; stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), 'openapi-coverage-'));
  const specPath = join(dir, 'openapi.json');
  const baselinePath = join(dir, 'baseline.json');
  writeFileSync(specPath, JSON.stringify(spec));
  writeFileSync(baselinePath, '[]');
  try {
    const stdout = execFileSync(
      process.execPath,
      ['--import', 'tsx', SCRIPT, '--spec', specPath, '--baseline', baselinePath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

function operation(overrides: Record<string, unknown>) {
  return {
    summary: 'probe',
    tags: ['probe'],
    responses: { '400': { description: 'bad request' }, ...overrides },
  };
}

describe('check-openapi-coverage', () => {
  it('accepts a redirect endpoint that documents a Location header', () => {
    const result = run({
      paths: {
        '/probe/image': {
          get: operation({
            '302': {
              description: 'Redirect to a freshly signed URL',
              headers: { Location: { schema: { type: 'string', format: 'uri' } } },
            },
          }),
        },
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('0 known gap(s)');
  });

  it('still rejects a redirect that documents no Location header', () => {
    const result = run({
      paths: { '/probe/image': { get: operation({ '302': { description: 'Somewhere' } }) } },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no success response documented');
  });

  it('still rejects an endpoint with no 2xx and no redirect', () => {
    const result = run({ paths: { '/probe/x': { get: operation({}) } } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no success response documented');
  });
});
