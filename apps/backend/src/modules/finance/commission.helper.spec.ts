import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { computeCommission } from './commission.helper';

const dec = (v: string | number) => new Prisma.Decimal(v);

describe('computeCommission', () => {
  // ─── Core calculation tests ───────────────────────────────────────────────

  it('employee 70%, no service override → 7000 from 10000 halalas', () => {
    const result = computeCommission({
      subtotalHalalas: 10000,
      employeeRate: dec('0.70'),
      serviceOverride: null,
    });
    expect(result.employeeShareHalalas).toBe(7000);
    expect(result.organizationShareHalalas).toBe(3000);
    expect(result.effectiveRate.toNumber()).toBeCloseTo(0.70, 10);
  });

  it('employee 70%, service override 50% → 5000 from 10000 halalas', () => {
    const result = computeCommission({
      subtotalHalalas: 10000,
      employeeRate: dec('0.70'),
      serviceOverride: dec('0.50'),
    });
    expect(result.employeeShareHalalas).toBe(5000);
    expect(result.organizationShareHalalas).toBe(5000);
    expect(result.effectiveRate.toNumber()).toBeCloseTo(0.50, 10);
  });

  it('rate = 0 → 0 for employee, all subtotal for organisation', () => {
    const result = computeCommission({
      subtotalHalalas: 10000,
      employeeRate: dec('0.00'),
      serviceOverride: undefined,
    });
    expect(result.employeeShareHalalas).toBe(0);
    expect(result.organizationShareHalalas).toBe(10000);
  });

  it('rate = 1 → all subtotal for employee, 0 for organisation', () => {
    const result = computeCommission({
      subtotalHalalas: 10000,
      employeeRate: dec('1.0'),
      serviceOverride: undefined,
    });
    expect(result.employeeShareHalalas).toBe(10000);
    expect(result.organizationShareHalalas).toBe(0);
  });

  it('rounding: subtotal 333, rate 0.5 → employee 167 (ROUND_HALF_UP) + org 166 = 333', () => {
    const result = computeCommission({
      subtotalHalalas: 333,
      employeeRate: dec('0.5'),
      serviceOverride: undefined,
    });
    expect(result.employeeShareHalalas).toBe(167);
    expect(result.organizationShareHalalas).toBe(166);
    expect(result.employeeShareHalalas + result.organizationShareHalalas).toBe(333);
  });

  it('float-drift guard: rate 0.15 on 10000 → employee 1500, no float artifacts', () => {
    const result = computeCommission({
      subtotalHalalas: 10000,
      employeeRate: dec('0.15'),
      serviceOverride: undefined,
    });
    expect(result.employeeShareHalalas).toBe(1500);
    expect(result.organizationShareHalalas).toBe(8500);
    expect(Number.isInteger(result.employeeShareHalalas)).toBe(true);
    expect(Number.isInteger(result.organizationShareHalalas)).toBe(true);
  });

  it('accepts Prisma.Decimal subtotal as well as number', () => {
    const result = computeCommission({
      subtotalHalalas: dec('10000'),
      employeeRate: dec('0.70'),
    });
    expect(result.employeeShareHalalas).toBe(7000);
  });

  it('employee + org shares always sum to subtotal (no halala lost)', () => {
    const cases = [
      { sub: 1, rate: '0.3333' },
      { sub: 9999, rate: '0.6667' },
      { sub: 100, rate: '0.1111' },
    ];
    for (const { sub, rate } of cases) {
      const result = computeCommission({
        subtotalHalalas: sub,
        employeeRate: dec(rate),
      });
      expect(result.employeeShareHalalas + result.organizationShareHalalas).toBe(sub);
    }
  });

  // ─── Input validation tests (defence-in-depth) ────────────────────────────

  it('throws BadRequestException when employeeRate is negative', () => {
    expect(() =>
      computeCommission({
        subtotalHalalas: 10000,
        employeeRate: dec('-0.1'),
      }),
    ).toThrow(BadRequestException);
  });

  it('throws BadRequestException when employeeRate exceeds 1', () => {
    expect(() =>
      computeCommission({
        subtotalHalalas: 10000,
        employeeRate: dec('1.5'),
      }),
    ).toThrow(BadRequestException);
  });

  it('throws BadRequestException when serviceOverride is negative', () => {
    expect(() =>
      computeCommission({
        subtotalHalalas: 10000,
        employeeRate: dec('0.70'),
        serviceOverride: dec('-0.01'),
      }),
    ).toThrow(BadRequestException);
  });

  it('throws BadRequestException when serviceOverride exceeds 1', () => {
    expect(() =>
      computeCommission({
        subtotalHalalas: 10000,
        employeeRate: dec('0.70'),
        serviceOverride: dec('1.0001'),
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts serviceOverride of exactly 0', () => {
    const result = computeCommission({
      subtotalHalalas: 10000,
      employeeRate: dec('0.70'),
      serviceOverride: dec('0'),
    });
    expect(result.employeeShareHalalas).toBe(0);
    expect(result.organizationShareHalalas).toBe(10000);
  });

  it('accepts serviceOverride of exactly 1', () => {
    const result = computeCommission({
      subtotalHalalas: 10000,
      employeeRate: dec('0.70'),
      serviceOverride: dec('1'),
    });
    expect(result.employeeShareHalalas).toBe(10000);
    expect(result.organizationShareHalalas).toBe(0);
  });
});
