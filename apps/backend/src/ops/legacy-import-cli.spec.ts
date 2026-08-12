import {
  parseLegacyImportCliOptions,
  validateLegacyImportTarget,
} from './legacy-import-cli';

describe('legacy import CLI guards', () => {
  it('defaults to dry-run', () => {
    const options = parseLegacyImportCliOptions([
      '--bundle',
      '/tmp/tenant-6.json',
      '--cutover-at',
      '2026-08-11T20:54:55Z',
    ]);

    expect(options.mode).toBe('dry-run');
  });

  it('rejects an unknown option', () => {
    expect(() =>
      parseLegacyImportCliOptions([
        '--bundle',
        '/tmp/tenant-6.json',
        '--cutover-at',
        '2026-08-11T20:54:55Z',
        '--force-anything',
      ]),
    ).toThrow('unknown argument');
  });

  it('requires the frozen cutover', () => {
    expect(() =>
      parseLegacyImportCliOptions([
        '--bundle',
        '/tmp/tenant-6.json',
        '--cutover-at',
        '2026-08-12T00:00:00Z',
      ]),
    ).toThrow('cutover must be exactly 2026-08-11T20:54:55Z');
  });

  it('rejects local apply against a remote database', () => {
    const options = parseLegacyImportCliOptions([
      '--apply',
      '--bundle',
      '/tmp/tenant-6.json',
      '--cutover-at',
      '2026-08-11T20:54:55Z',
      '--expected-database',
      'sawaa',
      '--expected-bundle-sha256',
      'a'.repeat(64),
      '--environment',
      'local',
      '--confirmation',
      'LEGACY-BOOKNETIC-TENANT-6-20260811',
    ]);

    expect(() =>
      validateLegacyImportTarget(
        options,
        'postgresql://user:pass@db.internal:5432/sawaa',
      ),
    ).toThrow('local apply requires a loopback database host');
  });

  it('requires exact database name and confirmation for production apply', () => {
    const options = parseLegacyImportCliOptions([
      '--apply',
      '--bundle',
      '/tmp/tenant-6.json',
      '--cutover-at',
      '2026-08-11T20:54:55Z',
      '--expected-database',
      'wrong',
      '--expected-bundle-sha256',
      'a'.repeat(64),
      '--environment',
      'production',
      '--confirmation',
      'wrong-token',
    ]);

    expect(() =>
      validateLegacyImportTarget(
        options,
        'postgresql://user:pass@postgres:5432/sawaa',
      ),
    ).toThrow('target database name does not match --expected-database');
  });
});
