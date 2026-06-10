import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  validateEmail,
  normalizeSaudiPhone,
  validateSaudiPhone,
} from './auth.schema';

describe('auth.schema', () => {
  describe('validatePassword', () => {
    it('rejects passwords shorter than 8 characters', () => {
      expect(validatePassword('Ab1')).toBe('Password must be at least 8 characters');
    });

    it('rejects passwords without uppercase letter', () => {
      expect(validatePassword('abcdefgh1')).toBe('Password must contain at least 1 uppercase letter');
    });

    it('rejects passwords without digit', () => {
      expect(validatePassword('ABCDEFGHa')).toBe('Password must contain at least 1 digit');
    });

    it('accepts valid password', () => {
      expect(validatePassword('SecurePass123')).toBeNull();
    });
  });

  describe('validateEmail', () => {
    it('rejects empty email', () => {
      expect(validateEmail('')).toBe('Invalid email address');
    });

    it('rejects invalid email format', () => {
      expect(validateEmail('notanemail')).toBe('Invalid email address');
    });

    it('accepts valid email', () => {
      expect(validateEmail('client@example.com')).toBeNull();
    });
  });

  describe('normalizeSaudiPhone', () => {
    it.each([
      ['0501234567', '+966501234567'],
      ['501234567', '+966501234567'],
      ['+966501234567', '+966501234567'],
      ['966501234567', '+966501234567'],
      ['00966501234567', '+966501234567'],
    ])('normalizes %s to %s', (input, expected) => {
      expect(normalizeSaudiPhone(input)).toBe(expected);
    });

    it('tolerates spaces and dashes', () => {
      expect(normalizeSaudiPhone('050 123 4567')).toBe('+966501234567');
      expect(normalizeSaudiPhone('050-123-4567')).toBe('+966501234567');
      expect(normalizeSaudiPhone('+966 50 123 4567')).toBe('+966501234567');
    });

    it.each([
      [''],
      ['abc'],
      ['12345'],
      ['0601234567'], // not a Saudi mobile prefix (05)
      ['+15551234567'], // non-Saudi country code
      ['05012345'], // too short
      ['050123456789'], // too long
      ['client@example.com'],
    ])('rejects %s', (input) => {
      expect(normalizeSaudiPhone(input)).toBeNull();
    });
  });

  describe('validateSaudiPhone', () => {
    it('returns null for a valid Saudi phone', () => {
      expect(validateSaudiPhone('0501234567')).toBeNull();
    });

    it('returns the i18n error key for an invalid phone', () => {
      expect(validateSaudiPhone('123')).toBe('auth.invalidPhone');
    });
  });
});
