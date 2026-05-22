import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * SECURITY (P1): reject any string containing CR or LF.
 *
 * Email header fields (subject, senderName, senderEmail, To, Cc, ...) are
 * assembled into raw RFC-5322 headers downstream. An attacker-controlled
 * newline can inject a `Bcc:` or arbitrary headers — classic SMTP header
 * injection. The fix is to refuse `\r` and `\n` at the validation boundary.
 *
 * Apply to ANY DTO field whose value ends up in an email header (or any
 * other line-delimited protocol).
 */
export function NoCRLF(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'noCRLF',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true; // other validators handle non-strings
          return !/[\r\n]/.test(value);
        },
        defaultMessage() {
          return `${propertyName} must not contain newline characters`;
        },
      },
    });
  };
}
