import { detectChannel, normalizeIdentifier, normalizePhone } from './identifier-detector';

describe('detectChannel', () => {
  it('returns EMAIL when value contains @', () => {
    expect(detectChannel('a@b.com')).toBe('EMAIL');
  });

  it('returns SMS for E.164 phone', () => {
    expect(detectChannel('+966501234567')).toBe('SMS');
  });

  it('returns SMS for digits-only', () => {
    expect(detectChannel('0501234567')).toBe('SMS');
  });

  it('throws on empty string', () => {
    expect(() => detectChannel('')).toThrow('Invalid identifier');
  });

  it('throws on whitespace-only string', () => {
    expect(() => detectChannel('   ')).toThrow('Invalid identifier');
  });
});

describe('normalizeIdentifier (email branch)', () => {
  it('lowercases email', () => {
    expect(normalizeIdentifier('FOO@Bar.com', 'EMAIL')).toBe('foo@bar.com');
  });

  it('trims surrounding whitespace from email', () => {
    expect(normalizeIdentifier('  foo@bar.com  ', 'EMAIL')).toBe('foo@bar.com');
  });
});

describe('normalizePhone — Saudi variants collapse to one E.164', () => {
  it('passes through canonical E.164 (+966 + 9 digits)', () => {
    expect(normalizePhone('+966512345678')).toBe('+966512345678');
  });

  it('rewrites 00966-prefixed numbers to +966', () => {
    expect(normalizePhone('00966512345678')).toBe('+966512345678');
  });

  it('treats bare 966-prefixed numbers as Saudi country code', () => {
    expect(normalizePhone('966512345678')).toBe('+966512345678');
  });

  it('expands local Saudi 0-prefixed numbers using default SA region', () => {
    expect(normalizePhone('0512345678')).toBe('+966512345678');
  });

  it('strips formatting characters from international numbers', () => {
    expect(normalizePhone('+1 (415) 555-0100')).toBe('+14155550100');
  });

  it('throws BadRequestException on empty input', () => {
    expect(() => normalizePhone('')).toThrow('invalid_phone');
  });

  it('throws BadRequestException on whitespace-only input', () => {
    expect(() => normalizePhone('   ')).toThrow('invalid_phone');
  });

  it('throws BadRequestException on garbage input', () => {
    expect(() => normalizePhone('not-a-phone')).toThrow('invalid_phone');
  });

  it('throws BadRequestException on too-short numbers', () => {
    expect(() => normalizePhone('12345')).toThrow('invalid_phone');
  });
});

describe('normalizeIdentifier (SMS branch — delegates to normalizePhone)', () => {
  it('strips internal whitespace and normalizes Saudi number', () => {
    expect(normalizeIdentifier(' +966 50 123 4567 ', 'SMS')).toBe('+966501234567');
  });

  it('collapses 00966 / 966 / 0-local to the same E.164', () => {
    expect(normalizeIdentifier('00966512345678', 'SMS')).toBe('+966512345678');
    expect(normalizeIdentifier('966512345678', 'SMS')).toBe('+966512345678');
    expect(normalizeIdentifier('0512345678', 'SMS')).toBe('+966512345678');
  });

  it('throws on invalid phone', () => {
    expect(() => normalizeIdentifier('abc', 'SMS')).toThrow('invalid_phone');
  });
});
