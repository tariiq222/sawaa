import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { ListPaymentsDto } from './list-payments.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListPaymentsDto, plain);
  return validate(dto);
}

describe('ListPaymentsDto', () => {
  it('accepts an empty payload (extends PaginationDto, all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully-populated valid payload', async () => {
    const errors = await validateDto({
      invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      method: PaymentMethod.MADA,
      status: PaymentStatus.COMPLETED,
      fromDate: '2026-05-01T00:00:00.000Z',
      toDate: '2026-05-31T23:59:59.000Z',
      search: '1024',
    });
    expect(errors).toHaveLength(0);
  });

  describe('UUID filters', () => {
    it('rejects a non-UUID invoiceId', async () => {
      const errors = await validateDto({ invoiceId: 'not-a-uuid' });
      expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
    });
    it('rejects a non-UUID clientId', async () => {
      const errors = await validateDto({ clientId: 'not-a-uuid' });
      expect(errors.some((e) => e.property === 'clientId')).toBe(true);
    });
  });

  describe('enums', () => {
    it('accepts every PaymentMethod value', async () => {
      for (const method of Object.values(PaymentMethod)) {
        const errors = await validateDto({ method });
        expect(errors).toHaveLength(0);
      }
    });
    it('rejects an unknown method', async () => {
      const errors = await validateDto({ method: 'BITCOIN' });
      expect(errors.some((e) => e.property === 'method')).toBe(true);
    });
    it('accepts every PaymentStatus value', async () => {
      for (const status of Object.values(PaymentStatus)) {
        const errors = await validateDto({ status });
        expect(errors).toHaveLength(0);
      }
    });
    it('rejects an unknown status', async () => {
      const errors = await validateDto({ status: 'INVENTED' });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });
  });

  describe('date range (IsDateString)', () => {
    it('rejects a non-date fromDate', async () => {
      const errors = await validateDto({ fromDate: 'yesterday' });
      expect(errors.some((e) => e.property === 'fromDate')).toBe(true);
    });
    it('rejects a non-date toDate', async () => {
      const errors = await validateDto({ toDate: 'tomorrow' });
      expect(errors.some((e) => e.property === 'toDate')).toBe(true);
    });
  });

  describe('search (IsString + MaxLength(120))', () => {
    it('accepts a 120-char string (upper bound)', async () => {
      const errors = await validateDto({ search: 'x'.repeat(120) });
      expect(errors).toHaveLength(0);
    });
    it('rejects a 121-char string', async () => {
      const errors = await validateDto({ search: 'x'.repeat(121) });
      expect(errors.some((e) => e.property === 'search')).toBe(true);
    });
    it('rejects a non-string', async () => {
      const errors = await validateDto({ search: { q: 'x' } });
      expect(errors.some((e) => e.property === 'search')).toBe(true);
    });
  });
});
