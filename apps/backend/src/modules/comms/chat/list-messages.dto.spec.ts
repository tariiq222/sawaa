import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListMessagesDto } from './list-messages.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListMessagesDto, plain);
  return validate(dto);
}

describe('ListMessagesDto', () => {
  it('accepts an empty payload (both fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid cursor and limit', async () => {
    const errors = await validateDto({
      cursor: '00000000-0000-0000-0000-000000000000',
      limit: 20,
    });
    expect(errors).toHaveLength(0);
  });

  it('coerces string limit to number', async () => {
    const errors = await validateDto({ limit: '15' });
    expect(errors.some((e) => e.property === 'limit')).toBe(false);
  });

  it('rejects a non-UUID cursor', async () => {
    const errors = await validateDto({ cursor: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'cursor')).toBe(true);
  });

  it('rejects limit < 1', async () => {
    const errors = await validateDto({ limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects a non-integer limit', async () => {
    const errors = await validateDto({ limit: 2.5 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
