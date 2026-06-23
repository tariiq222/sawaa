import { DeliveryType } from '@prisma/client';
import { normalizeDeliveryTypeInput } from './delivery-type-input.helper';

describe('normalizeDeliveryTypeInput', () => {
  describe('canonical inputs', () => {
    it('returns IN_PERSON for the canonical "IN_PERSON" enum value', () => {
      expect(normalizeDeliveryTypeInput(DeliveryType.IN_PERSON)).toBe(DeliveryType.IN_PERSON);
    });

    it('returns ONLINE for the canonical "ONLINE" enum value', () => {
      expect(normalizeDeliveryTypeInput(DeliveryType.ONLINE)).toBe(DeliveryType.ONLINE);
    });
  });

  describe('string aliases', () => {
    it('uppercases "in_person" and returns IN_PERSON', () => {
      expect(normalizeDeliveryTypeInput('in_person')).toBe(DeliveryType.IN_PERSON);
    });

    it('uppercases the UI alias "IN-PERSON" (hyphen variant) to IN_PERSON', () => {
      expect(normalizeDeliveryTypeInput('IN-PERSON')).toBe(DeliveryType.IN_PERSON);
    });

    it('lowercases are accepted: "in-person", "In-Person", "  IN_PERSON  "', () => {
      expect(normalizeDeliveryTypeInput('in-person')).toBe(DeliveryType.IN_PERSON);
      expect(normalizeDeliveryTypeInput('In-Person')).toBe(DeliveryType.IN_PERSON);
      expect(normalizeDeliveryTypeInput('  IN_PERSON  ')).toBe(DeliveryType.IN_PERSON);
    });

    it('uppercases "online" to ONLINE', () => {
      expect(normalizeDeliveryTypeInput('online')).toBe(DeliveryType.ONLINE);
    });

    it('accepts an "ONLINE" string verbatim', () => {
      expect(normalizeDeliveryTypeInput('ONLINE')).toBe(DeliveryType.ONLINE);
    });
  });

  describe('invalid / missing input', () => {
    it('falls back to IN_PERSON for an unknown string (defensive default)', () => {
      expect(normalizeDeliveryTypeInput('TELEPATHY')).toBe(DeliveryType.IN_PERSON);
    });

    it('falls back to IN_PERSON when called with no argument', () => {
      expect(normalizeDeliveryTypeInput()).toBe(DeliveryType.IN_PERSON);
    });

    it('falls back to IN_PERSON when given null', () => {
      expect(normalizeDeliveryTypeInput(null)).toBe(DeliveryType.IN_PERSON);
    });

    it('falls back to IN_PERSON when given an empty string', () => {
      // Empty string is a string, but trims to "" and the lookup fails.
      expect(normalizeDeliveryTypeInput('')).toBe(DeliveryType.IN_PERSON);
    });
  });
});
