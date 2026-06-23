import { formatBookingRef } from './booking-ref.util';

describe('formatBookingRef', () => {
  it('formats bookingNumber to a 4-digit zero-padded reference', () => {
    expect(formatBookingRef(1, 'clxyz123abc456def')).toBe('#0001');
  });

  it('formats bookingNumber 42 to #0042', () => {
    expect(formatBookingRef(42, 'clxyz123abc456def')).toBe('#0042');
  });

  it('formats bookingNumber 1234 to #1234 (exactly 4 digits, no truncation)', () => {
    expect(formatBookingRef(1234, 'clxyz123abc456def')).toBe('#1234');
  });

  it('formats bookingNumber > 9999 to its full numeric width', () => {
    expect(formatBookingRef(12345, 'clxyz123abc456def')).toBe('#12345');
  });

  it('falls back to the last 6 chars of bookingId when bookingNumber is undefined', () => {
    expect(formatBookingRef(undefined, 'clxyz123abc456def')).toBe('#456def');
  });

  it('falls back to the last 6 chars of bookingId when bookingNumber is null', () => {
    expect(formatBookingRef(null as unknown as undefined, 'clxyz123abc456def')).toBe('#456def');
  });

  it('uses the last 6 chars even when the bookingId is short', () => {
    expect(formatBookingRef(undefined, 'abc')).toBe('#abc');
  });

  it('treats bookingNumber=0 as a valid number (renders #0000)', () => {
    expect(formatBookingRef(0, 'clxyz123abc456def')).toBe('#0000');
  });

  it('returns a string starting with # in every branch', () => {
    expect(formatBookingRef(7, 'some-id').startsWith('#')).toBe(true);
    expect(formatBookingRef(undefined, 'some-id').startsWith('#')).toBe(true);
  });
});
