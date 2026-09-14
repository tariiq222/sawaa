import { BadRequestException } from '@nestjs/common';
import { allocateSessionNet } from './package-group-pricing';
import type { GlobalDiscount } from './package-group-pricing';

describe('allocateSessionNet', () => {
  it('allocates a percentage discount proportionally by session price', () => {
    expect(
      allocateSessionNet([30_000, 15_000, 20_000, 25_000], {
        type: 'PERCENTAGE',
        value: 10,
      }),
    ).toEqual({
      subtotal: 90_000,
      discountAmount: 9_000,
      amountPaid: 81_000,
      sessionNet: [27_000, 13_500, 18_000, 22_500],
    });
  });

  it('uses exact decimal percentage arithmetic', () => {
    expect(
      allocateSessionNet([1_000], { type: 'PERCENTAGE', value: 12.5 }),
    ).toEqual({
      subtotal: 1_000,
      discountAmount: 125,
      amountPaid: 875,
      sessionNet: [875],
    });
  });

  it('floors a fractional discount before heterogeneous allocation', () => {
    expect(
      allocateSessionNet([3, 7], { type: 'PERCENTAGE', value: 12.5 }),
    ).toEqual({
      subtotal: 10,
      discountAmount: 1,
      amountPaid: 9,
      sessionNet: [3, 6],
    });
  });

  it('allocates a fixed discount and distributes a remainder stably', () => {
    expect(
      allocateSessionNet([1, 1, 1], { type: 'FIXED', value: 1 }),
    ).toEqual({
      subtotal: 3,
      discountAmount: 1,
      amountPaid: 2,
      sessionNet: [1, 1, 0],
    });

    expect(
      allocateSessionNet([4, 3, 2], { type: 'FIXED', value: 4 }),
    ).toEqual({
      subtotal: 9,
      discountAmount: 4,
      amountPaid: 5,
      sessionNet: [2, 2, 1],
    });
  });

  it.each([
    ['no discount', { type: 'NONE', value: 0 }],
    ['zero percentage', { type: 'PERCENTAGE', value: 0 }],
    ['one hundred percent', { type: 'PERCENTAGE', value: 100 }],
  ] as const)('supports %s', (_label, discount) => {
    const result = allocateSessionNet([20, 30], discount);
    expect(result.subtotal).toBe(50);
    expect(result.amountPaid).toBe(discount.type === 'PERCENTAGE' && discount.value === 100 ? 0 : 50);
    expect(result.sessionNet.reduce((sum, value) => sum + value, 0)).toBe(result.amountPaid);
  });

  it('keeps zero price sessions at zero', () => {
    expect(
      allocateSessionNet([0, 10, 0], { type: 'FIXED', value: 1 }),
    ).toEqual({
      subtotal: 10,
      discountAmount: 1,
      amountPaid: 9,
      sessionNet: [0, 9, 0],
    });
  });

  it('returns zeros for an all-zero subtotal with no payable amount', () => {
    expect(allocateSessionNet([0, 0], { type: 'NONE', value: 0 })).toEqual({
      subtotal: 0,
      discountAmount: 0,
      amountPaid: 0,
      sessionNet: [0, 0],
    });
    expect(allocateSessionNet([0, 0], { type: 'PERCENTAGE', value: 100 })).toEqual({
      subtotal: 0,
      discountAmount: 0,
      amountPaid: 0,
      sessionNet: [0, 0],
    });
  });

  it('does not mutate the input prices and always conserves amount paid', () => {
    const cases: Array<[number[], GlobalDiscount]> = [
      [[1, 2, 7], { type: 'NONE', value: 0 }],
      [[2, 5, 9, 11], { type: 'FIXED', value: 8 }],
      [[3, 8, 13], { type: 'PERCENTAGE', value: 33.333 }],
      [[0, 4, 0, 9], { type: 'PERCENTAGE', value: 12.5 }],
    ];

    for (const [prices, discount] of cases) {
      const original = [...prices];
      const result = allocateSessionNet(prices, discount);
      expect(prices).toEqual(original);
      expect(result.sessionNet.reduce((sum, value) => sum + value, 0)).toBe(result.amountPaid);
      expect(result.sessionNet.every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);
    }
  });

  it.each([
    ['empty prices', [], { type: 'NONE', value: 0 }, 'Prices must be a non-empty array'],
    ['negative price', [-1], { type: 'NONE', value: 0 }, 'Price at index 0 must be a non-negative safe integer'],
    ['fractional price', [1.5], { type: 'NONE', value: 0 }, 'Price at index 0 must be a non-negative safe integer'],
    ['NaN price', [Number.NaN], { type: 'NONE', value: 0 }, 'Price at index 0 must be a non-negative safe integer'],
    ['infinite price', [Number.POSITIVE_INFINITY], { type: 'NONE', value: 0 }, 'Price at index 0 must be a non-negative safe integer'],
    ['unsafe price', [Number.MAX_SAFE_INTEGER + 1], { type: 'NONE', value: 0 }, 'Price at index 0 must be a non-negative safe integer'],
    ['unsafe subtotal', [Number.MAX_SAFE_INTEGER, 1], { type: 'NONE', value: 0 }, 'Session price subtotal must be a safe integer'],
    ['negative fixed discount', [10], { type: 'FIXED', value: -1 }, 'Fixed discount value must be a non-negative safe integer'],
    ['fractional fixed discount', [10], { type: 'FIXED', value: 1.5 }, 'Fixed discount value must be a non-negative safe integer'],
    ['fixed discount over subtotal', [10], { type: 'FIXED', value: 11 }, 'Fixed discount cannot exceed the session price subtotal'],
    ['negative percentage discount', [10], { type: 'PERCENTAGE', value: -1 }, 'Percentage discount value must be a finite number from 0 to 100'],
    ['percentage over one hundred', [10], { type: 'PERCENTAGE', value: 100.1 }, 'Percentage discount value must be a finite number from 0 to 100'],
    ['NaN percentage discount', [10], { type: 'PERCENTAGE', value: Number.NaN }, 'Percentage discount value must be a finite number from 0 to 100'],
    ['infinite percentage discount', [10], { type: 'PERCENTAGE', value: Number.POSITIVE_INFINITY }, 'Percentage discount value must be a finite number from 0 to 100'],
    ['nonzero none discount', [10], { type: 'NONE', value: 1 }, 'NONE discount value must be 0'],
    ['unknown discount type', [10], { type: 'BOGUS', value: 0 } as unknown as GlobalDiscount, 'Discount type must be NONE, PERCENTAGE, or FIXED'],
  ] as const)('rejects %s with a stable message', (_label, prices, discount, message) => {
    const action = () => allocateSessionNet([...prices], discount as GlobalDiscount);
    expect(action).toThrow(BadRequestException);
    expect(action).toThrow(message);
  });
});
