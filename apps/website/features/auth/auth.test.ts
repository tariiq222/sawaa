import { describe, it, expect } from 'vitest';
import { validatePassword, validateEmail } from './auth.schema';

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
});
