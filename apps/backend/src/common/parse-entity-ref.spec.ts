import { BadRequestException } from '@nestjs/common';
import { parseEntityRef } from './parse-entity-ref';

describe('parseEntityRef', () => {
  describe('UUID branch', () => {
    it('returns kind="uuid" for a canonical UUID', () => {
      const result = parseEntityRef('550e8400-e29b-41d4-a716-446655440000', 'USR');
      expect(result).toEqual({ kind: 'uuid', id: '550e8400-e29b-41d4-a716-446655440000' });
    });

    it('accepts a UUID in upper-case', () => {
      const result = parseEntityRef('550E8400-E29B-41D4-A716-446655440000', 'USR');
      expect(result).toEqual({ kind: 'uuid', id: '550E8400-E29B-41D4-A716-446655440000' });
    });
  });

  describe('ref branch', () => {
    it('returns kind="ref" with the parsed integer for "<PREFIX>-<n>"', () => {
      const result = parseEntityRef('USR-42', 'USR');
      expect(result).toEqual({ kind: 'ref', ref: 42 });
    });

    it('accepts the prefix case-insensitively', () => {
      expect(parseEntityRef('usr-42', 'USR')).toEqual({ kind: 'ref', ref: 42 });
      expect(parseEntityRef('Usr-42', 'USR')).toEqual({ kind: 'ref', ref: 42 });
    });

    it('handles very large reference numbers (e.g. GS-1024)', () => {
      expect(parseEntityRef('GS-1024', 'GS')).toEqual({ kind: 'ref', ref: 1024 });
    });

    it('rejects the wrong prefix', () => {
      // "USR-42" parsed with prefix "GS" is not a match.
      expect(() => parseEntityRef('USR-42', 'GS')).toThrow(BadRequestException);
    });
  });

  describe('malformed input', () => {
    it('throws BadRequestException on an empty string', () => {
      expect(() => parseEntityRef('', 'USR')).toThrow(BadRequestException);
    });

    it('throws BadRequestException on a ref that has no number', () => {
      // "USR-" matches the regex shape but the captured group is empty,
      // so `Number("")` produces NaN — this should still be rejected.
      expect(() => parseEntityRef('USR-', 'USR')).toThrow(BadRequestException);
    });

    it('throws BadRequestException on a non-matching shape', () => {
      expect(() => parseEntityRef('hello', 'USR')).toThrow(BadRequestException);
    });

    it('throws BadRequestException on a UUID with a typo', () => {
      // One hex digit replaced with 'g' — not a valid UUID.
      expect(() => parseEntityRef('550g8400-e29b-41d4-a716-446655440000', 'USR')).toThrow(
        BadRequestException,
      );
    });
  });
});
