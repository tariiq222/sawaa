import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BookFromCreditDto } from './book-from-credit.dto';

const ids = {
  clientId: '00000000-0000-4000-a000-000000000001',
  creditId: '00000000-0000-4000-a000-000000000002',
  serviceId: '00000000-0000-4000-a000-000000000003',
  employeeId: '00000000-0000-4000-a000-000000000004',
  durationOptionId: '00000000-0000-4000-a000-000000000005',
  branchId: '00000000-0000-4000-a000-000000000006',
};

async function validateDto(input: Record<string, unknown>) {
  return validate(plainToInstance(BookFromCreditDto, {
    ...ids,
    scheduledAt: '2026-12-31T09:00:00.000Z',
    ...input,
  }));
}

describe('BookFromCreditDto', () => {
  it('validates every supplied target field when creditId is present', async () => {
    const errors = await validateDto({ creditId: ids.creditId, serviceId: 'not-a-uuid' });

    expect(errors.some((error) => error.property === 'serviceId')).toBe(true);
  });

  it('rejects a partial explicit target instead of falling back to credit routing', async () => {
    const errors = await validateDto({
      creditId: ids.creditId,
      serviceId: ids.serviceId,
      employeeId: ids.employeeId,
      durationOptionId: undefined,
    });

    expect(errors.some((error) => error.property === 'durationOptionId')).toBe(true);
  });

  it('accepts a complete explicit target with creditId', async () => {
    await expect(validateDto({ creditId: ids.creditId })).resolves.toEqual([]);
  });
});
