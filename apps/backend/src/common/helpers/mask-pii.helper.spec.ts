import { maskEmail, maskIdentifier } from './mask-pii.helper';

describe('mask-pii', () => {
  it('should mask email', () => {
    expect(maskEmail('test@example.com')).toBe('t***@example.com');
  });

  it('should return *** for invalid email', () => {
    expect(maskEmail('invalid')).toBe('***');
  });

  it('should mask phone identifier', () => {
    expect(maskIdentifier('+966501234567')).toBe('+9665XXXXX67');
  });

  it('should mask short identifier', () => {
    expect(maskIdentifier('abc')).toBe('***');
  });

  it('should mask regular identifier', () => {
    expect(maskIdentifier('username123')).toBe('u***23');
  });

  it('should mask email via maskIdentifier', () => {
    expect(maskIdentifier('test@example.com')).toBe('t***@example.com');
  });
});
