import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  validateEmail,
  normalizeSaudiPhone,
  validateSaudiPhone,
} from './auth.schema';

describe('auth.schema', () => {
  describe('validatePassword', () => {
    it('rejects an empty string with the length message', () => {
      expect(validatePassword('')).toBe('Password must be at least 8 characters');
    });

    it('rejects a password shorter than 8 characters', () => {
      expect(validatePassword('Aa1')).toBe('Password must be at least 8 characters');
      expect(validatePassword('Aa1bbbb')).toBe('Password must be at least 8 characters');
    });

    it('rejects when no uppercase letter is present', () => {
      expect(validatePassword('longpassword1')).toBe(
        'Password must contain at least 1 uppercase letter',
      );
    });

    it('rejects when no digit is present', () => {
      expect(validatePassword('LongPassword')).toBe(
        'Password must contain at least 1 digit',
      );
    });

    it('accepts an 8+ character password with uppercase and a digit', () => {
      expect(validatePassword('Secret12')).toBeNull();
      expect(validatePassword('LongPassword9')).toBeNull();
    });

    it('checks uppercase before digit (length > uppercase > digit ordering)', () => {
      // Short + no uppercase + no digit → length wins
      expect(validatePassword('a1')).toBe('Password must be at least 8 characters');
      // Long enough + no uppercase + no digit → uppercase wins
      expect(validatePassword('longpassword')).toBe(
        'Password must contain at least 1 uppercase letter',
      );
    });
  });

  describe('validateEmail', () => {
    it('rejects an empty string', () => {
      expect(validateEmail('')).toBe('Invalid email address');
    });

    it('rejects malformed emails (no @, no domain, no TLD, spaces)', () => {
      expect(validateEmail('plainaddress')).toBe('Invalid email address');
      expect(validateEmail('user@')).toBe('Invalid email address');
      expect(validateEmail('user@domain')).toBe('Invalid email address');
      expect(validateEmail('@domain.com')).toBe('Invalid email address');
      expect(validateEmail('user @domain.com')).toBe('Invalid email address');
    });

    it('accepts well-formed emails', () => {
      expect(validateEmail('a@b.co')).toBeNull();
      expect(validateEmail('sara.test+sawa@example.com')).toBeNull();
    });
  });

  describe('normalizeSaudiPhone', () => {
    it('returns null for an empty input', () => {
      expect(normalizeSaudiPhone('')).toBeNull();
    });

    it('returns null for non-Saudi or malformed numbers', () => {
      expect(normalizeSaudiPhone('12345678')).toBeNull(); // too short
      expect(normalizeSaudiPhone('051234567')).toBeNull(); // only 9 chars
      expect(normalizeSaudiPhone('05123456789012')).toBeNull(); // too long
      expect(normalizeSaudiPhone('0612345678')).toBeNull(); // starts with 06 (not 05)
      expect(normalizeSaudiPhone('+9715XXXXXXXX')).toBeNull(); // wrong country
      expect(normalizeSaudiPhone('foo bar baz')).toBeNull();
    });

    it('passes through numbers already in E.164 (`+9665XXXXXXXX`)', () => {
      expect(normalizeSaudiPhone('+966500000000')).toBe('+966500000000');
    });

    it('prefixes `9665XXXXXXXX` with `+`', () => {
      expect(normalizeSaudiPhone('966500000000')).toBe('+966500000000');
    });

    it('strips the `00` prefix from `009665XXXXXXXX`', () => {
      expect(normalizeSaudiPhone('00966500000000')).toBe('+966500000000');
    });

    it('converts `05XXXXXXXX` (local form) to E.164', () => {
      expect(normalizeSaudiPhone('0500000000')).toBe('+966500000000');
    });

    it('converts `5XXXXXXXX` (no leading zero) to E.164', () => {
      expect(normalizeSaudiPhone('500000000')).toBe('+966500000000');
    });

    it('tolerates spaces and dashes anywhere in the input', () => {
      expect(normalizeSaudiPhone('050 000 0000')).toBe('+966500000000');
      expect(normalizeSaudiPhone('050-000-0000')).toBe('+966500000000');
      expect(normalizeSaudiPhone('+966 5 000 000 00')).toBe('+966500000000');
    });
  });

  describe('validateSaudiPhone', () => {
    it('returns the i18n key `auth.invalidPhone` for invalid input', () => {
      expect(validateSaudiPhone('')).toBe('auth.invalidPhone');
      expect(validateSaudiPhone('abc')).toBe('auth.invalidPhone');
      expect(validateSaudiPhone('0612345678')).toBe('auth.invalidPhone');
    });

    it('returns null for valid Saudi mobile numbers across accepted forms', () => {
      expect(validateSaudiPhone('+966500000000')).toBeNull();
      expect(validateSaudiPhone('966500000000')).toBeNull();
      expect(validateSaudiPhone('0500000000')).toBeNull();
      expect(validateSaudiPhone('500000000')).toBeNull();
    });
  });
});
