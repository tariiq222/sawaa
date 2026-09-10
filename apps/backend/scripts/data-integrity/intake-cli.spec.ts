import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openExclusiveNdjson, parseIntakeCliArgs, writeExclusiveJson } from './intake-cli';

describe('intake integrity CLI', () => {
  it('defaults to a bounded dry-run and rejects apply-only flags', () => {
    expect(parseIntakeCliArgs(['--output', 'manifest.json', '--max-groups', '7']))
      .toMatchObject({ mode: 'dry-run', outputPath: 'manifest.json', maxGroups: 7 });
    expect(parseIntakeCliArgs(['--dry-run', '--output', 'manifest.json']))
      .toMatchObject({ mode: 'dry-run', outputPath: 'manifest.json' });
    expect(() => parseIntakeCliArgs([
      '--output', 'manifest.json', '--confirm-database', 'sawaa_test',
    ])).toThrow('Apply-only arguments require apply mode');
  });

  it('requires every apply safeguard and rejects unknown or out-of-range arguments', () => {
    expect(parseIntakeCliArgs([
      'apply', '--manifest', 'reviewed.json', '--receipt', 'receipt.json',
      '--confirm-database', 'sawaa_test', '--old-writers-drained',
    ])).toMatchObject({ mode: 'apply', manifestPath: 'reviewed.json', receiptPath: 'receipt.json' });
    expect(parseIntakeCliArgs([
      '--apply', '--manifest', 'reviewed.json', '--receipt', 'receipt.json',
      '--confirm-database', 'sawaa_test', '--old-writers-drained',
    ])).toMatchObject({ mode: 'apply', manifestPath: 'reviewed.json', receiptPath: 'receipt.json' });
    expect(() => parseIntakeCliArgs(['apply', '--manifest', 'reviewed.json']))
      .toThrow('Apply requires --receipt');
    expect(() => parseIntakeCliArgs(['--output', 'manifest.json', '--max-groups', '101']))
      .toThrow('max-groups must be an integer from 1 to 100');
    expect(() => parseIntakeCliArgs(['--output', 'manifest.json', '--unexpected']))
      .toThrow('Unknown argument');
  });

  it('creates private JSON output exactly once with mode 0600', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sawaa-intake-cli-'));
    const output = join(directory, 'manifest.json');
    try {
      await writeExclusiveJson(output, { version: 1, groups: [] });
      expect(JSON.parse(await readFile(output, 'utf8'))).toEqual({ version: 1, groups: [] });
      await expect(writeExclusiveJson(output, { version: 1, groups: [{ id: 'changed' }] }))
        .rejects.toThrow('Refusing to overwrite existing output');
      expect(await readFile(output, 'utf8')).toContain('"groups": []');
      expect((await stat(output)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('flushes each protected receipt line and preserves earlier lines after close', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sawaa-intake-receipts-'));
    const output = join(directory, 'receipt.ndjson');
    try {
      const writer = await openExclusiveNdjson(output);
      await writer.append({ bookingId: 'booking-a', status: 'applied' });
      await writer.close();
      await expect(writer.append({ bookingId: 'booking-b', status: 'applied' }))
        .rejects.toThrow('Receipt output is already closed');
      expect((await readFile(output, 'utf8')).trim().split('\n')).toEqual([
        '{"bookingId":"booking-a","status":"applied"}',
      ]);
      expect((await stat(output)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
