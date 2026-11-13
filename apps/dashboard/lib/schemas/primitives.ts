import { z } from "zod"

/**
 * Shared field primitives for dashboard form schemas.
 *
 * They exist so the few places where zod 4 differs from the behaviour the
 * forms were written against are decided once, here, instead of per schema.
 * `test/unit/lib/schemas/zod-message-pins.spec.ts` pins the resulting
 * behaviour for every form schema.
 */

/**
 * An entity id as the API hands it out: any 8-4-4-4-12 hex string.
 *
 * Do not use `z.string().uuid()` for ids. In zod 4 it also enforces the RFC
 * version/variant bits, which the backend does not, so an id the server
 * accepts could be rejected by the form.
 *
 * `message` applies to a malformed id only; a missing value still reports
 * "required" through the global error map.
 */
export const entityId = (message?: string) => z.string().check(z.guid(message))

/** An email address. `message` applies to a malformed address only. */
export const emailAddress = (message?: string) => z.string().check(z.email(message))

/**
 * A number typed into a form input ("12", 12, "" → 0). Typed as `number` on
 * both sides so react-hook-form field values keep their numeric type.
 *
 * `invalidMessage` replaces the "not a number" message only. Range checks such
 * as `.min(0, "key")` keep their own messages.
 */
export const formNumber = (invalidMessage?: string) =>
  z.coerce.number<number>(
    invalidMessage === undefined
      ? undefined
      : { error: (issue) => (issue.code === "invalid_type" ? invalidMessage : undefined) },
  )
