import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListClientsDto } from './list-clients.dto';
import { ClientGender, ClientSource } from '@prisma/client';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListClientsDto, plain);
  return validate(dto);
}

describe('ListClientsDto', () => {
  it('accepts an empty payload (all filters optional, pagination defaults)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('coerces isActive = "true" to boolean true', async () => {
    const dto = plainToInstance(ListClientsDto, { isActive: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('coerces isActive = "false" to boolean false', async () => {
    const dto = plainToInstance(ListClientsDto, { isActive: 'false' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });

  it('rejects a non-boolean isActive (string that is not "true"/"false")', async () => {
    const errors = await validateDto({ isActive: 'yes' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('accepts search as a string', async () => {
    const errors = await validateDto({ search: 'Sara' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string search', async () => {
    const errors = await validateDto({ search: 42 });
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('uppercases a lowercase gender', async () => {
    const dto = plainToInstance(ListClientsDto, { gender: 'female' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.gender).toBe(ClientGender.FEMALE);
  });

  it('rejects an out-of-enum gender', async () => {
    const errors = await validateDto({ gender: 'OTHER' });
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('uppercases a lowercase source', async () => {
    const dto = plainToInstance(ListClientsDto, { source: 'referral' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.source).toBe(ClientSource.REFERRAL);
  });

  it('rejects an out-of-enum source', async () => {
    const errors = await validateDto({ source: 'BANNER' });
    expect(errors.some((e) => e.property === 'source')).toBe(true);
  });

  it('coerces page from string to integer', async () => {
    const dto = plainToInstance(ListClientsDto, { page: '2' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
  });

  it('rejects page < 1', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit > 200', async () => {
    const errors = await validateDto({ limit: 201 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts limit at the boundary (exactly 200)', async () => {
    const errors = await validateDto({ limit: 200 });
    expect(errors).toHaveLength(0);
  });
});
