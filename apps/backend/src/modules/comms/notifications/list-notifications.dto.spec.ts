import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListNotificationsDto } from './list-notifications.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListNotificationsDto, plain);
  return validate(dto);
}

describe('ListNotificationsDto', () => {
  it('accepts a valid payload without unreadOnly (optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts unreadOnly omitted (optional)', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'unreadOnly')).toBe(false);
  });

  it('accepts unreadOnly = true', async () => {
    const errors = await validateDto({ unreadOnly: true });
    expect(errors).toHaveLength(0);
  });

  it('coerces string "true" to boolean (Transform)', async () => {
    const errors = await validateDto({ unreadOnly: 'true' });
    expect(errors.some((e) => e.property === 'unreadOnly')).toBe(false);
  });

  it('rejects unreadOnly with a non-boolean value', async () => {
    const errors = await validateDto({ unreadOnly: 'not-a-bool' });
    expect(errors.some((e) => e.property === 'unreadOnly')).toBe(true);
  });
});
