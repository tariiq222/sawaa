import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RefundType } from '@prisma/client';
import { ApproveCancelBookingDto } from './approve-cancel-booking.dto';

const build = (raw: Record<string, unknown> = {}) =>
  plainToInstance(ApproveCancelBookingDto, raw);

describe('ApproveCancelBookingDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validate(build());
    expect(errors).toHaveLength(0);
  });

  it('accepts approverNotes within the 500-char limit', async () => {
    const errors = await validate(build({ approverNotes: 'Approved per client request' }));
    expect(errors).toHaveLength(0);
  });

  it('rejects approverNotes longer than 500 characters', async () => {
    const errors = await validate(build({ approverNotes: 'x'.repeat(501) }));
    expect(errors.some((e) => e.property === 'approverNotes')).toBe(true);
  });

  it('rejects approverNotes that is not a string', async () => {
    const errors = await validate(build({ approverNotes: 12345 as unknown as string }));
    expect(errors.some((e) => e.property === 'approverNotes')).toBe(true);
  });

  it('accepts a valid RefundType enum value (PARTIAL with amount)', async () => {
    const errors = await validate(build({ refundType: RefundType.PARTIAL, refundAmount: 5000 }));
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid RefundType enum value (FULL)', async () => {
    const errors = await validate(build({ refundType: RefundType.FULL }));
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid RefundType enum value (NONE)', async () => {
    const errors = await validate(build({ refundType: RefundType.NONE }));
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid refundType that is not a RefundType enum value', async () => {
    const errors = await validate(build({ refundType: 'COMPLETE_REFUND' as unknown as RefundType }));
    expect(errors.some((e) => e.property === 'refundType')).toBe(true);
  });

  it('accepts refundAmount > 0 with refundType=PARTIAL', async () => {
    const errors = await validate(build({ refundType: RefundType.PARTIAL, refundAmount: 5000 }));
    expect(errors).toHaveLength(0);
  });

  it('rejects refundAmount missing when refundType is PARTIAL', async () => {
    const errors = await validate(build({ refundType: RefundType.PARTIAL }));
    expect(errors.some((e) => e.property === 'refundAmount')).toBe(true);
    const refundAmountError = errors.find((e) => e.property === 'refundAmount');
    expect(refundAmountError?.constraints?.isDefined).toContain('PARTIAL');
  });

  it('rejects refundAmount of 0 (below Min(1))', async () => {
    const errors = await validate(build({ refundType: RefundType.PARTIAL, refundAmount: 0 }));
    expect(errors.some((e) => e.property === 'refundAmount')).toBe(true);
  });

  it('rejects negative refundAmount', async () => {
    const errors = await validate(build({ refundType: RefundType.PARTIAL, refundAmount: -100 }));
    expect(errors.some((e) => e.property === 'refundAmount')).toBe(true);
  });

  it('rejects non-integer refundAmount', async () => {
    const errors = await validate(
      build({ refundType: RefundType.PARTIAL, refundAmount: 12.5 as unknown as number }),
    );
    expect(errors.some((e) => e.property === 'refundAmount')).toBe(true);
  });

  it('does not reject refundAmount=5000 when refundType is FULL (DTO allows; handler rejects)', async () => {
    // The DTO's @ValidateIf condition is `refundType === PARTIAL || refundAmount !== undefined`.
    // When refundType=FULL and amount=5000, the condition is true (amount defined) → the
    // shape validators (IsDefined/IsInt/Min) run and ALL PASS. The runtime guard
    // "FULL/NONE with refundAmount" lives in the handler, not in the DTO.
    const errors = await validate(build({ refundType: RefundType.FULL, refundAmount: 5000 }));
    expect(errors).toHaveLength(0);
  });

  it('does not reject refundAmount=5000 when refundType is NONE (DTO allows; handler rejects)', async () => {
    const errors = await validate(build({ refundType: RefundType.NONE, refundAmount: 5000 }));
    expect(errors).toHaveLength(0);
  });

  it('accepts refundAmount=1 (boundary value at Min(1))', async () => {
    const errors = await validate(build({ refundType: RefundType.PARTIAL, refundAmount: 1 }));
    expect(errors).toHaveLength(0);
  });
});
