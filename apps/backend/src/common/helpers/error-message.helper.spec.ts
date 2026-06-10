import { errorMessage } from './error-message.helper';

describe('errorMessage', () => {
  it('returns the message for Error instances', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the message for Error subclasses', () => {
    class CustomError extends Error {}
    expect(errorMessage(new CustomError('custom boom'))).toBe('custom boom');
  });

  it('returns strings as-is', () => {
    expect(errorMessage('plain failure')).toBe('plain failure');
  });

  it('JSON-stringifies plain objects', () => {
    expect(errorMessage({ code: 'E_FAIL', status: 500 })).toBe('{"code":"E_FAIL","status":500}');
  });

  it('handles null', () => {
    expect(errorMessage(null)).toBe('null');
  });

  it('handles undefined', () => {
    expect(errorMessage(undefined)).toBe('undefined');
  });

  it('handles numbers', () => {
    expect(errorMessage(42)).toBe('42');
  });

  it('never throws on circular objects', () => {
    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;
    expect(() => errorMessage(circular)).not.toThrow();
    expect(typeof errorMessage(circular)).toBe('string');
    expect(errorMessage(circular)).toBe('[object Object]');
  });

  it('never returns a non-string for exotic values', () => {
    expect(typeof errorMessage(Symbol('sym'))).toBe('string');
    expect(typeof errorMessage(BigInt(9))).toBe('string');
    expect(typeof errorMessage(() => undefined)).toBe('string');
  });
});
