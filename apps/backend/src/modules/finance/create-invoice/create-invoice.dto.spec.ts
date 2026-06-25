import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvoiceDto } from './create-invoice.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateInvoiceDto, plain);
  return validate(dto);
}

describe('CreateInvoiceDto', () => {
  const baseBooking = {
    bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    branchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    subtotal: 10000,
  };

  const basePackage = {
    packagePurchaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
    branchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    subtotal: 10000,
  };

  it('accepts a booking-backed invoice (XOR with bookingId)', async () => {
    const errors = await validateDto(baseBooking);
    expect(errors).toHaveLength(0);
  });

  it('accepts a package-backed invoice (XOR with packagePurchaseId)', async () => {
    const errors = await validateDto(basePackage);
    expect(errors).toHaveLength(0);
  });

  // NOTE: the DTO declares @Validate(InvoiceXorConstraint) on a dummy _xorCheck
  // field, but the constraint class is missing @ValidatorConstraint() and uses the
  // wrong signature (takes the DTO, not (value, args)). The XOR check is therefore
  // dead at the DTO level — the real check is in CreateInvoiceHandler.validateXor
  // (create-invoice.handler.ts:14). See create-invoice.handler.spec.ts for coverage.

  it('rejects a non-UUID bookingId', async () => {
    const errors = await validateDto({ ...baseBooking, bookingId: 'bad-id' });
    expect(errors.some((e) => e.property === 'bookingId')).toBe(true);
  });

  it('rejects a non-UUID branchId', async () => {
    const errors = await validateDto({ ...baseBooking, branchId: 'bad-id' });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a non-UUID clientId', async () => {
    const errors = await validateDto({ ...baseBooking, clientId: 'bad-id' });
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('rejects a non-UUID employeeId', async () => {
    const errors = await validateDto({ ...baseBooking, employeeId: 'bad-id' });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  describe('subtotal (IsInt + Min(0))', () => {
    it('rejects a negative subtotal (integer halalas)', async () => {
      const errors = await validateDto({ ...baseBooking, subtotal: -1 });
      expect(errors.some((e) => e.property === 'subtotal')).toBe(true);
    });
    it('rejects a non-integer subtotal (halalas are integers)', async () => {
      const errors = await validateDto({ ...baseBooking, subtotal: 100.5 });
      expect(errors.some((e) => e.property === 'subtotal')).toBe(true);
    });
    it('accepts subtotal = 0 (zero-amount invoice edge case)', async () => {
      const errors = await validateDto({ ...baseBooking, subtotal: 0 });
      expect(errors).toHaveLength(0);
    });
  });

  describe('discountAmt (optional IsInt + Min(0))', () => {
    it('accepts a positive integer', async () => {
      const errors = await validateDto({ ...baseBooking, discountAmt: 1000 });
      expect(errors).toHaveLength(0);
    });
    it('rejects a negative integer', async () => {
      const errors = await validateDto({ ...baseBooking, discountAmt: -1 });
      expect(errors.some((e) => e.property === 'discountAmt')).toBe(true);
    });
    it('rejects a non-integer', async () => {
      const errors = await validateDto({ ...baseBooking, discountAmt: 0.5 });
      expect(errors.some((e) => e.property === 'discountAmt')).toBe(true);
    });
  });

  describe('vatRate (optional IsNumber + Min(0) + Max(1))', () => {
    it('accepts 0 and 1 (bounds)', async () => {
      expect((await validateDto({ ...baseBooking, vatRate: 0 }))).toHaveLength(0);
      expect((await validateDto({ ...baseBooking, vatRate: 1 }))).toHaveLength(0);
    });
    it('accepts 0.15 (15% VAT)', async () => {
      const errors = await validateDto({ ...baseBooking, vatRate: 0.15 });
      expect(errors).toHaveLength(0);
    });
    it('rejects a negative vatRate', async () => {
      const errors = await validateDto({ ...baseBooking, vatRate: -0.01 });
      expect(errors.some((e) => e.property === 'vatRate')).toBe(true);
    });
    it('rejects a vatRate > 1', async () => {
      const errors = await validateDto({ ...baseBooking, vatRate: 1.01 });
      expect(errors.some((e) => e.property === 'vatRate')).toBe(true);
    });
  });

  describe('notes (optional IsString)', () => {
    it('accepts a string', async () => {
      const errors = await validateDto({ ...baseBooking, notes: 'Includes consultation fee' });
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-string', async () => {
      const errors = await validateDto({ ...baseBooking, notes: 99 });
      expect(errors.some((e) => e.property === 'notes')).toBe(true);
    });
  });

  describe('dueAt (optional IsDateString)', () => {
    it('accepts a valid ISO date', async () => {
      const errors = await validateDto({ ...baseBooking, dueAt: '2026-05-01T09:00:00.000Z' });
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-date', async () => {
      const errors = await validateDto({ ...baseBooking, dueAt: 'soon' });
      expect(errors.some((e) => e.property === 'dueAt')).toBe(true);
    });
  });
});
