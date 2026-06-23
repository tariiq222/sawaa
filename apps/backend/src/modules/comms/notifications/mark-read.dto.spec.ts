import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MarkReadDto } from './mark-read.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(MarkReadDto, plain);
  return validate(dto);
}

describe('MarkReadDto', () => {
  it('accepts an empty payload (both fields optional — mark-all mode)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid notificationId', async () => {
    const errors = await validateDto({ notificationId: '00000000-0000-0000-0000-000000000000' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID notificationId', async () => {
    const errors = await validateDto({ notificationId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'notificationId')).toBe(true);
  });

  it('rejects an empty-string notificationId', async () => {
    const errors = await validateDto({ notificationId: '' });
    expect(errors.some((e) => e.property === 'notificationId')).toBe(true);
  });

  it('rejects a numeric notificationId', async () => {
    const errors = await validateDto({ notificationId: 12345 });
    expect(errors.some((e) => e.property === 'notificationId')).toBe(true);
  });
});
