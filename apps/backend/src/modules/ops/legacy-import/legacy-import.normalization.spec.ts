import {
  canonicalName,
  epochSecondsToDate,
  mapDeliveryType,
  mapHistoricalStatus,
  normalizeEmail,
  normalizeSaudiPhone,
  sarToHalalas,
} from './legacy-import.normalization';

describe('legacy import normalization', () => {
  it.each([
    ['0501234567', '+966501234567'],
    ['966501234567', '+966501234567'],
    ['⁦96650641461403⁩', null],
    ['', null],
  ])('normalizes Saudi phone %p', (input, expected) => {
    expect(normalizeSaudiPhone(input)).toBe(expected);
  });

  it.each([
    [' Test@Example.COM ', 'test@example.com'],
    ['missing-at.example.com', null],
    ['', null],
    [null, null],
  ])('normalizes email %p', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it('collapses whitespace without changing Arabic letters', () => {
    expect(canonicalName('  د.  ماجد\nالحربي ')).toBe('د. ماجد الحربي');
  });

  it.each([
    ['approved', 'CONFIRMED'],
    ['canceled', 'CANCELLED'],
    ['pending', 'EXPIRED'],
    ['rejected', 'CANCELLED'],
  ] as const)('maps historical status %s', (source, expected) => {
    expect(mapHistoricalStatus(source)).toBe(expected);
  });

  it('keeps epoch as UTC without adding three hours', () => {
    expect(epochSecondsToDate(1_692_201_600).toISOString()).toBe(
      '2023-08-16T16:00:00.000Z',
    );
  });

  it('converts exact legacy SAR decimals to integer halalas', () => {
    expect(sarToHalalas('200.0000')).toBe(20_000);
    expect(sarToHalalas('149.9900')).toBe(14_999);
  });

  it('rejects a legacy amount that contains a sub-halalah fraction', () => {
    expect(() => sarToHalalas('10.0010')).toThrow('sub-halalah');
  });

  it.each([
    [103, 'ONLINE'],
    [141, 'ONLINE'],
    [272, 'ONLINE'],
    [273, 'ONLINE'],
    [286, 'ONLINE'],
    [78, 'IN_PERSON'],
  ] as const)('maps service %i delivery type', (serviceId, expected) => {
    expect(mapDeliveryType(serviceId)).toBe(expected);
  });
});
