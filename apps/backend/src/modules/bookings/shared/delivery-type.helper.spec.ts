import { BookingType, DeliveryType } from '@prisma/client';
import {
  normalizeBookingTypes,
  requiresZoom,
} from './delivery-type.helper';

describe('normalizeBookingTypes', () => {
  describe('legacy aliases', () => {
    it('maps legacy bookingType="ONLINE" to INDIVIDUAL + ONLINE', () => {
      const result = normalizeBookingTypes({ bookingType: 'ONLINE' });
      expect(result.bookingType).toBe(BookingType.INDIVIDUAL);
      expect(result.deliveryType).toBe(DeliveryType.ONLINE);
    });

    it('maps UI snake_case alias bookingType="in_person" to INDIVIDUAL + IN_PERSON', () => {
      const result = normalizeBookingTypes({ bookingType: 'in_person' });
      expect(result.bookingType).toBe(BookingType.INDIVIDUAL);
      expect(result.deliveryType).toBe(DeliveryType.IN_PERSON);
    });

    it('is case-insensitive on the in_person legacy alias', () => {
      const result = normalizeBookingTypes({ bookingType: 'In_Person' });
      expect(result.bookingType).toBe(BookingType.INDIVIDUAL);
      expect(result.deliveryType).toBe(DeliveryType.IN_PERSON);
    });
  });

  describe('new model (bookingType + deliveryType)', () => {
    it('passes through INDIVIDUAL with explicit ONLINE', () => {
      const result = normalizeBookingTypes({
        bookingType: BookingType.INDIVIDUAL,
        deliveryType: DeliveryType.ONLINE,
      });
      expect(result).toEqual({
        bookingType: BookingType.INDIVIDUAL,
        deliveryType: DeliveryType.ONLINE,
      });
    });

    it('passes through GROUP with explicit IN_PERSON', () => {
      const result = normalizeBookingTypes({
        bookingType: BookingType.GROUP,
        deliveryType: DeliveryType.IN_PERSON,
      });
      expect(result).toEqual({
        bookingType: BookingType.GROUP,
        deliveryType: DeliveryType.IN_PERSON,
      });
    });

    it('passes through WALK_IN with explicit ONLINE', () => {
      const result = normalizeBookingTypes({
        bookingType: BookingType.WALK_IN,
        deliveryType: DeliveryType.ONLINE,
      });
      expect(result).toEqual({
        bookingType: BookingType.WALK_IN,
        deliveryType: DeliveryType.ONLINE,
      });
    });
  });

  describe('defaults', () => {
    it('defaults bookingType to INDIVIDUAL when neither is given', () => {
      const result = normalizeBookingTypes({});
      expect(result.bookingType).toBe(BookingType.INDIVIDUAL);
    });

    it('defaults deliveryType to IN_PERSON for INDIVIDUAL when not provided', () => {
      const result = normalizeBookingTypes({ bookingType: BookingType.INDIVIDUAL });
      expect(result.deliveryType).toBe(DeliveryType.IN_PERSON);
    });

    it('defaults deliveryType to IN_PERSON for GROUP when not provided', () => {
      const result = normalizeBookingTypes({ bookingType: BookingType.GROUP });
      expect(result.deliveryType).toBe(DeliveryType.IN_PERSON);
    });

    it('maps WALK_IN to IN_PERSON by default when no deliveryType is supplied', () => {
      const result = normalizeBookingTypes({ bookingType: BookingType.WALK_IN });
      expect(result.deliveryType).toBe(DeliveryType.IN_PERSON);
    });

    it('honours an explicit deliveryType for WALK_IN (current behaviour)', () => {
      // The function only forces IN_PERSON for WALK_IN on the default branch;
      // an explicit value is respected as written.
      const result = normalizeBookingTypes({
        bookingType: BookingType.WALK_IN,
        deliveryType: DeliveryType.ONLINE,
      });
      expect(result.deliveryType).toBe(DeliveryType.ONLINE);
    });
  });

  describe('precedence', () => {
    it('uses an explicit deliveryType over a legacy-derived one', () => {
      // bookingType=ONLINE derives ONLINE, but caller supplies IN_PERSON → IN_PERSON wins.
      const result = normalizeBookingTypes({
        bookingType: 'ONLINE',
        deliveryType: DeliveryType.IN_PERSON,
      });
      expect(result.deliveryType).toBe(DeliveryType.IN_PERSON);
      expect(result.bookingType).toBe(BookingType.INDIVIDUAL);
    });

    it('uppercases a lowercase deliveryType string before validating', () => {
      const result = normalizeBookingTypes({
        bookingType: BookingType.INDIVIDUAL,
        deliveryType: 'online',
      });
      expect(result.deliveryType).toBe(DeliveryType.ONLINE);
    });
  });

  describe('invalid input', () => {
    it('ignores an unknown bookingType and falls back to INDIVIDUAL + IN_PERSON', () => {
      const result = normalizeBookingTypes({ bookingType: 'NOT_A_TYPE' });
      expect(result.bookingType).toBe(BookingType.INDIVIDUAL);
      expect(result.deliveryType).toBe(DeliveryType.IN_PERSON);
    });

    it('ignores an unknown deliveryType and falls back to IN_PERSON', () => {
      const result = normalizeBookingTypes({
        bookingType: BookingType.INDIVIDUAL,
        deliveryType: 'TELEPATHY',
      });
      expect(result.deliveryType).toBe(DeliveryType.IN_PERSON);
    });

    it('treats null values as absent and applies defaults', () => {
      const result = normalizeBookingTypes({
        bookingType: null,
        deliveryType: null,
      });
      expect(result.bookingType).toBe(BookingType.INDIVIDUAL);
      expect(result.deliveryType).toBe(DeliveryType.IN_PERSON);
    });
  });
});

describe('requiresZoom', () => {
  it('returns true for ONLINE deliveryType', () => {
    expect(requiresZoom(DeliveryType.ONLINE)).toBe(true);
  });

  it('returns false for IN_PERSON deliveryType', () => {
    expect(requiresZoom(DeliveryType.IN_PERSON)).toBe(false);
  });
});
