import { validateSync } from 'class-validator';
import { NoCRLF } from './no-crlf.validator';

class EmailHeaderDto {
  @NoCRLF()
  subject!: unknown;

  constructor(subject: unknown) {
    this.subject = subject;
  }
}

function errorsFor(value: unknown) {
  return validateSync(new EmailHeaderDto(value));
}

describe('NoCRLF', () => {
  describe('rejects header-injection payloads', () => {
    it.each([
      ['LF', 'Hello\nBcc: attacker@evil.test'],
      ['CR', 'Hello\rBcc: attacker@evil.test'],
      ['CRLF', 'Hello\r\nBcc: attacker@evil.test'],
      ['leading newline', '\nX-Injected: 1'],
      ['trailing newline', 'Subject\n'],
      ['newline only', '\n'],
      ['carriage return only', '\r'],
    ])('rejects a string containing %s', (_label, value) => {
      const errors = errorsFor(value);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toEqual({
        noCRLF: 'subject must not contain newline characters',
      });
    });
  });

  describe('accepts safe values', () => {
    it('accepts a normal subject line', () => {
      expect(errorsFor('Booking confirmed — Sawa')).toHaveLength(0);
    });

    it('accepts an empty string', () => {
      expect(errorsFor('')).toHaveLength(0);
    });

    it('accepts strings with other whitespace (tabs, spaces)', () => {
      expect(errorsFor('hello\tworld and spaces')).toHaveLength(0);
    });
  });

  describe('non-string values pass through to other validators', () => {
    it.each([
      ['number', 42],
      ['null', null],
      ['undefined', undefined],
      ['object', { evil: '\r\n' }],
      ['array', ['\n']],
    ])('does not reject %s', (_label, value) => {
      expect(errorsFor(value)).toHaveLength(0);
    });
  });
});
