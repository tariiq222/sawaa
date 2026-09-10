import { parseAuditCliArgs } from './audit-finance-cli';

describe('audit-finance-cli', () => {
  it('defaults to a bounded read-only page and accepts resumable category cursors', () => {
    expect(parseAuditCliArgs([
      '--output', 'audit.json', '--batch-size', '25', '--stalled-hours', '48',
      '--cursor', 'STALLED_OUTBOX=event-1', '--completed', 'INTAKE_CURRENT_DUPLICATE',
    ])).toEqual({
      outputPath: 'audit.json', batchSize: 25, stalledOutboxHours: 48,
      cursors: { STALLED_OUTBOX: 'event-1' }, completedCategories: ['INTAKE_CURRENT_DUPLICATE'],
    });
  });

  it.each([
    ['apply', 'Apply and repair'], ['--apply', 'Apply and repair'], ['--repair', 'Apply and repair'],
  ])('rejects %s without opening a database', (arg, message) => {
    expect(() => parseAuditCliArgs(['--output', 'audit.json', arg])).toThrow(message);
  });

  it('rejects unsafe or ambiguous options', () => {
    expect(() => parseAuditCliArgs([])).toThrow('--output');
    expect(() => parseAuditCliArgs(['--output', 'a', '--batch-size', '101'])).toThrow('batch-size');
    expect(() => parseAuditCliArgs(['--output', 'a', '--cursor', 'UNKNOWN=id'])).toThrow('known audit category');
    expect(() => parseAuditCliArgs(['--output', 'a', '--cursor', 'STALLED_OUTBOX='])).toThrow('CATEGORY=VALUE');
  });
});

