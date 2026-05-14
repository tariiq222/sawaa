import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('merges tailwind classes without duplicates', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
  it('honors conditional entries', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
  it('handles arrays and objects', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });
});
