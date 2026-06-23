import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListConversationsDto } from './list-conversations.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListConversationsDto, plain);
  return validate(dto);
}

describe('ListConversationsDto', () => {
  it('accepts an empty payload (no filters)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid clientId and employeeId', async () => {
    const errors = await validateDto({
      clientId: '00000000-0000-0000-0000-000000000000',
      employeeId: '12345678-1234-4234-8234-123456789abc',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts valid pagination', async () => {
    const errors = await validateDto({ page: 1, limit: 20 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID clientId', async () => {
    const errors = await validateDto({ clientId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('rejects a non-UUID employeeId', async () => {
    const errors = await validateDto({ employeeId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects page < 1', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });
});
