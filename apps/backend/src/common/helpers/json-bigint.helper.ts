/**
 * JSON serialization for HTTP responses that may contain Prisma `BigInt`.
 *
 * Express's `res.json` calls `JSON.stringify` with the app's `json replacer`
 * (Express 5 reads it in `lib/response.js`). Node throws
 * `TypeError: Do not know how to serialize a BigInt` on a bare `bigint`, so any
 * endpoint returning a raw Prisma row with a `BigInt` column answers 500.
 *
 * This replacer encodes a `bigint` as a JSON number when it is within the safe
 * integer range, and as a decimal string beyond it (a JSON number cannot carry
 * it exactly). Nothing else changes: every non-bigint value is returned
 * untouched, so existing responses are byte-identical.
 */
export function bigintJsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value !== 'bigint') return value;
  if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return value.toString();
}
