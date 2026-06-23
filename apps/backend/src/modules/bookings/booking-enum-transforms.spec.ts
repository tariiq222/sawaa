import { mapDeliveryType } from './booking-enum-transforms';

describe('mapDeliveryType', () => {
  it('uppercases the snake_case UI alias "in_person" to the enum "IN_PERSON"', () => {
    expect(mapDeliveryType('in_person')).toBe('IN_PERSON');
  });

  it('uppercases the snake_case UI alias "online" to the enum "ONLINE"', () => {
    expect(mapDeliveryType('online')).toBe('ONLINE');
  });

  it('passes an already-uppercase value through unchanged', () => {
    expect(mapDeliveryType('IN_PERSON')).toBe('IN_PERSON');
    expect(mapDeliveryType('ONLINE')).toBe('ONLINE');
  });

  it('returns an empty string for an empty input (still a string, not coerced)', () => {
    expect(mapDeliveryType('')).toBe('');
  });

  it('passes undefined and null through untouched so @IsEnum can report them', () => {
    expect(mapDeliveryType(undefined)).toBeUndefined();
    expect(mapDeliveryType(null)).toBeNull();
  });

  it('passes numeric values through untouched', () => {
    expect(mapDeliveryType(42)).toBe(42);
    expect(mapDeliveryType(0)).toBe(0);
  });

  it('passes non-string objects through untouched', () => {
    const obj = { kind: 'IN_PERSON' };
    expect(mapDeliveryType(obj)).toBe(obj);
  });

  it('uppercases mixed case without throwing', () => {
    expect(mapDeliveryType('In_Person')).toBe('IN_PERSON');
    expect(mapDeliveryType('Online')).toBe('ONLINE');
  });
});
