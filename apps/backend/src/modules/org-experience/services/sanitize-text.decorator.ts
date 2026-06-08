import { Transform } from 'class-transformer';

/**
 * Strips HTML tags (and any leftover angle brackets) from string values and
 * trims surrounding whitespace. No-op for non-string values. Apply BEFORE the
 * validation decorators so the transform runs first (transform runs before
 * validation when `transform: true` is enabled on the global pipe).
 *
 * SQL injection is already prevented by Prisma parameterization — this only
 * guards against stored HTML/JS (XSS).
 */
export function SanitizeText() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    // remove tags and any leftover angle brackets, then trim
    const stripped = value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
    return stripped.trim();
  });
}
