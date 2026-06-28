import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListTenantDeliveryLogsDto } from './list-tenant-delivery-logs.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListTenantDeliveryLogsDto, plain);
  return validate(dto);
}

describe('ListTenantDeliveryLogsDto', () => {
  it('accepts an empty payload (uses class defaults)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid status and channel filter', async () => {
    const errors = await validateDto({ status: 'SENT', channel: 'EMAIL' });
    expect(errors).toHaveLength(0);
  });

  it('accepts valid page and limit', async () => {
    const errors = await validateDto({ page: 1, limit: 20 });
    expect(errors).toHaveLength(0);
  });

  it('coerces string page to number via Type(() => Number)', async () => {
    const errors = await validateDto({ page: '2' });
    expect(errors.some((e) => e.property === 'page')).toBe(false);
  });

  it('rejects a status outside the enum', async () => {
    const errors = await validateDto({ status: 'BOGUS' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects a channel outside the enum', async () => {
    const errors = await validateDto({ channel: 'BOGUS' });
    expect(errors.some((e) => e.property === 'channel')).toBe(true);
  });

  it('rejects page < 1', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit < 1', async () => {
    const errors = await validateDto({ limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects limit > 100', async () => {
    const errors = await validateDto({ limit: 101 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts limit at the Max(100) boundary', async () => {
    const errors = await validateDto({ limit: 100 });
    expect(errors.some((e) => e.property === 'limit')).toBe(false);
  });
});
