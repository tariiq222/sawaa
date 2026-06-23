import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListActivityDto } from './list-activity.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListActivityDto, plain);
  return validate(dto);
}

describe('ListActivityDto', () => {
  it('accepts an empty payload (no filters)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid userId', async () => {
    const errors = await validateDto({
      userId: 'c1d2e3f4-a5b6-4789-8def-012345678901',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID userId', async () => {
    const errors = await validateDto({ userId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('accepts a valid entity filter', async () => {
    const errors = await validateDto({ entity: 'Booking' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string entity', async () => {
    const errors = await validateDto({ entity: 12345 });
    expect(errors.some((e) => e.property === 'entity')).toBe(true);
  });

  it('rejects a non-UUID entityId', async () => {
    const errors = await validateDto({ entityId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'entityId')).toBe(true);
  });

  it.each(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'SYSTEM'])(
    'accepts action=%s',
    async (action) => {
      const errors = await validateDto({ action });
      expect(errors.some((e) => e.property === 'action')).toBe(false);
    },
  );

  it('rejects an action outside the enum', async () => {
    const errors = await validateDto({ action: 'BOGUS' });
    expect(errors.some((e) => e.property === 'action')).toBe(true);
  });

  it('accepts a valid from/to date range', async () => {
    const errors = await validateDto({ from: '2026-01-01', to: '2026-04-17' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-ISO from date string', async () => {
    const errors = await validateDto({ from: 'not-a-date' });
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('rejects a non-ISO to date string', async () => {
    const errors = await validateDto({ to: 'not-a-date' });
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('accepts valid pagination', async () => {
    const errors = await validateDto({ page: 1, limit: 20 });
    expect(errors).toHaveLength(0);
  });
});
