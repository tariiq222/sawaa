/**
 * Normalizes an unknown thrown value into a human-readable string.
 *
 * - `Error` instances → their `message`.
 * - Strings → returned as-is.
 * - Everything else → a safe JSON-ish representation.
 *
 * Never throws and always returns a string, so it is safe inside catch
 * blocks and log interpolation (`` `failed: ${errorMessage(err)}` ``).
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    const json = JSON.stringify(err);
    // JSON.stringify(undefined) and stringify of functions/symbols return undefined.
    if (typeof json === 'string') return json;
  } catch {
    // Circular structures, BigInt, hostile toJSON — fall through to String().
  }
  try {
    return String(err);
  } catch {
    return '[unserializable error]';
  }
}
