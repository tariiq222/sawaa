import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListContactMessagesDto } from './list-contact-messages.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListContactMessagesDto, plain);
  return validate(dto);
}

describe('ListContactMessagesDto', () => {
  it('accepts an empty payload (no filters)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts NEW as status', async () => {
    const errors = await validateDto({ status: 'NEW' });
    expect(errors).toHaveLength(0);
  });

  it('accepts READ as status', async () => {
    const errors = await validateDto({ status: 'READ' });
    expect(errors).toHaveLength(0);
  });

  it('accepts ARCHIVED as status', async () => {
    const errors = await validateDto({ status: 'ARCHIVED' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a status outside the enum', async () => {
    const errors = await validateDto({ status: 'BOGUS' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects a lowercase status', async () => {
    const errors = await validateDto({ status: 'new' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('accepts valid pagination', async () => {
    const errors = await validateDto({ page: 1, limit: 10 });
    expect(errors).toHaveLength(0);
  });
});
