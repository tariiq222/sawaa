import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Guard for MNT-21 item 21.5 (stage م4) — dashboard side.
 *
 * Value parity with the committed OpenAPI snapshot and the compile-time
 * round-trip are already enforced in `packages/api-client/src/types/booking.ts`
 * and its `booking.test.ts`. Repeating them here would only create a second
 * place to update, so this file guards the one regression neither of those can
 * see: the dashboard reintroducing a local copy of the status vocabulary.
 *
 * Before this change `@/lib/types/booking` declared its own 10-value union
 * while the file's doc comment claimed entity shapes were derived from the
 * snapshot.
 */
const bookingTypesSource = readFileSync(
  join(__dirname, "../../../../lib/types/booking.ts"),
  "utf8",
)

describe("dashboard booking types", () => {
  it("re-exports the status vocabulary from the shared client", () => {
    expect(bookingTypesSource).toContain('from "@sawaa/api-client/types"')
  })

  it("does not declare its own BookingStatus union", () => {
    // A pasted-back union is the regression. The derived alias in api-client is
    // `Lowercase<Schemas['BookingStatus']>`, which this pattern does not match.
    expect(bookingTypesSource).not.toMatch(/export type BookingStatus =\s*(\||"|')/)
  })

  it("does not declare its own runtime status list", () => {
    expect(bookingTypesSource).not.toMatch(
      /export const BOOKING_STATUSES\s*=\s*\[/,
    )
  })
})
