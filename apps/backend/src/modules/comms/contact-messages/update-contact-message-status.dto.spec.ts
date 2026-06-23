import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateContactMessageStatusDto } from './update-contact-message-status.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateContactMessageStatusDto, plain);
  return validate(dto);
}

describe('UpdateContactMessageStatusDto', () => {
  it('accepts NEW', async () => {
    const errors = await validateDto({ status: 'NEW' });
    expect(errors).toHaveLength(0);
  });

  it('accepts READ', async () => {
    const errors = await validateDto({ status: 'READ' });
    expect(errors).toHaveLength(0);
  });

  it('accepts REPLIED', async () => {
    const errors = await validateDto({ status: 'REPLIED' });
    expect(errors).toHaveLength(0);
  });

  it('accepts ARCHIVED', async () => {
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

  it('rejects a missing status', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects a numeric status', async () => {
    const errors = await validateDto({ status: 1 });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
