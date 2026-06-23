import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetDashboardStatsDto } from './get-dashboard-stats.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(GetDashboardStatsDto, plain);
  return validate(dto);
}

describe('GetDashboardStatsDto', () => {
  it('accepts an empty payload (both fields are optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid from date', async () => {
    const errors = await validateDto({ from: '2026-05-01' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid to date', async () => {
    const errors = await validateDto({ to: '2026-05-31' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid from/to pair', async () => {
    const errors = await validateDto({ from: '2026-05-01', to: '2026-05-31' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a from date in a non-yyyy-MM-dd format', async () => {
    const errors = await validateDto({ from: '2026/05/01' });
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('rejects a to date in a non-yyyy-MM-dd format', async () => {
    const errors = await validateDto({ to: '31-05-2026' });
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('rejects a from date with time component', async () => {
    const errors = await validateDto({ from: '2026-05-01T00:00:00' });
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('rejects a to date with time component', async () => {
    const errors = await validateDto({ to: '2026-05-31T23:59:59Z' });
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('rejects a non-string from value', async () => {
    const errors = await validateDto({ from: 20260501 });
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('rejects a from that is just whitespace', async () => {
    const errors = await validateDto({ from: '   ' });
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('accepts the to-date upper bound (yyyy-MM-dd format strict)', async () => {
    // 2026-12-31 is a valid yyyy-MM-dd form; the regex allows it.
    const errors = await validateDto({ to: '2026-12-31' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a from with extra trailing characters', async () => {
    const errors = await validateDto({ from: '2026-05-01extra' });
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });
});
