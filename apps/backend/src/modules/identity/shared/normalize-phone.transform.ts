import { Transform, type TransformFnParams } from 'class-transformer';
import type { CountryCode } from 'libphonenumber-js';
import { normalizePhone } from './identifier-detector';

/**
 * Class-transformer decorator that runs `normalizePhone` on the field at DTO
 * deserialization time. By the time the value reaches a handler, it is
 * guaranteed to be a canonical E.164 string (or class-validator has already
 * rejected the request via the `BadRequestException` thrown from inside the
 * normalizer).
 *
 * Usage:
 *   class MyDto {
 *     @ApiProperty()
 *     @IsString()
 *     @NormalizePhone()
 *     phone!: string;
 *   }
 */
export function NormalizePhone(defaultRegion: CountryCode = 'SA'): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) => {
    if (value === undefined || value === null || value === '') return value;
    if (typeof value !== 'string') return value;
    return normalizePhone(value, defaultRegion);
  });
}

/**
 * Variant for fields that may carry either a phone OR an email (e.g. the
 * `identifier` field on OTP DTOs and mobile login). If the value contains
 * `@`, it is left untouched so that `IsEmail`-style validators can still run
 * (and email lowercase trimming happens at handler ingress via
 * `normalizeIdentifier`). Otherwise it is normalized as a phone.
 */
export function NormalizePhoneOrEmail(defaultRegion: CountryCode = 'SA'): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) => {
    if (value === undefined || value === null || value === '') return value;
    if (typeof value !== 'string') return value;
    if (value.includes('@')) return value.trim().toLowerCase();
    return normalizePhone(value, defaultRegion);
  });
}
