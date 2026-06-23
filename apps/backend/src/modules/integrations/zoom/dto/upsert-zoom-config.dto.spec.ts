import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertZoomConfigDto } from './upsert-zoom-config.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertZoomConfigDto, plain);
  return validate(dto);
}

describe('UpsertZoomConfigDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a full payload', async () => {
    const errors = await validateDto({
      zoomClientId: 'your_client_id',
      zoomClientSecret: 'your_client_secret',
      zoomAccountId: 'your_account_id',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial payload (clientId only)', async () => {
    const errors = await validateDto({ zoomClientId: 'abc' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string zoomClientId', async () => {
    const errors = await validateDto({ zoomClientId: 12345 });
    expect(errors.some((e) => e.property === 'zoomClientId')).toBe(true);
  });

  it('rejects an empty zoomClientId', async () => {
    const errors = await validateDto({ zoomClientId: '' });
    expect(errors.some((e) => e.property === 'zoomClientId')).toBe(true);
  });

  it('rejects a non-string zoomClientSecret', async () => {
    const errors = await validateDto({ zoomClientSecret: { token: 'x' } });
    expect(errors.some((e) => e.property === 'zoomClientSecret')).toBe(true);
  });

  it('rejects an empty zoomClientSecret', async () => {
    const errors = await validateDto({ zoomClientSecret: '' });
    expect(errors.some((e) => e.property === 'zoomClientSecret')).toBe(true);
  });

  it('rejects a non-string zoomAccountId', async () => {
    const errors = await validateDto({ zoomAccountId: 999 });
    expect(errors.some((e) => e.property === 'zoomAccountId')).toBe(true);
  });

  it('rejects an empty zoomAccountId', async () => {
    const errors = await validateDto({ zoomAccountId: '' });
    expect(errors.some((e) => e.property === 'zoomAccountId')).toBe(true);
  });
});
