/**
 * Contract test for the dashboard client types (MNT-08).
 *
 * `lib/types/client.ts` derives `Client` from the committed OpenAPI snapshot,
 * which documents two response shapes: the full record for staff
 * (`ClientResponseDto`) and the 16-key record for EMPLOYEE-role callers
 * (`EmployeeScopedClientResponseDto`). These assertions run at type-check time
 * (`pnpm --filter dashboard typecheck`) and at test time, and fail when a
 * documented deviation stops being a deviation or when the wire shape moves
 * underneath the dashboard.
 */
import { describe, expect, it } from "vitest"
import type { components } from "@/lib/types/api.generated"
import type { Client } from "@/lib/types/client"

type ClientWire = components["schemas"]["ClientResponseDto"]
type EmployeeScopedWire = components["schemas"]["EmployeeScopedClientResponseDto"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T
type RequiredKeys<T> = { [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? K : never }[keyof T]
type OptionalKeys<T> = { [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? never : K }[keyof T]

/** Keys only staff receive: the full record minus the employee-scoped record. */
type StaffOnlyKeys = Exclude<keyof ClientWire, keyof EmployeeScopedWire>

/** The employee-scoped record is exactly what serializeEmployeeClient emits. */
type _EmployeeScopedKeys = Expect<
  Equal<
    keyof EmployeeScopedWire,
    | "id" | "ref" | "name" | "firstName" | "lastName" | "phone" | "email"
    | "dateOfBirth" | "gender" | "avatarUrl" | "accountType" | "isActive"
    | "lastBooking" | "nextBooking" | "createdAt" | "updatedAt"
  >
>
/** The full record is the employee-scoped one plus extra keys (20 today). */
type _FullExtendsEmployeeScoped = Expect<ClientWire extends EmployeeScopedWire ? true : false>
type _StaffKeysAreNonEmpty = Expect<[StaffOnlyKeys] extends [never] ? false : true>

/** Every field the API sends exists on the dashboard type, and nothing else does. */
type _CoversWireShape = Expect<Equal<Exclude<keyof ClientWire, keyof Client>, never>>
type _AddsNothing = Expect<Equal<Exclude<keyof Client, keyof ClientWire>, never>>

/**
 * Presence: the always-present keys are required, and the staff-only key set is
 * exactly (keys of ClientResponseDto) minus (keys of the employee-scoped DTO).
 */
type _AlwaysPresentAreRequired = Expect<Equal<RequiredKeys<Client>, keyof EmployeeScopedWire>>
type _StaffOnlyAreOptional = Expect<Equal<OptionalKeys<Client>, StaffOnlyKeys>>

/** Fields the dashboard intentionally narrows or reshapes (see lib/types/client.ts). */
type _FirstNameIsNarrowed = Expect<Equal<Client["firstName"], string>>
type _LastNameIsNarrowed = Expect<Equal<Client["lastName"], string>>
type _EmailVerifiedIsBoolean = Expect<Equal<Client["emailVerified"], boolean | undefined>>
type _WireNamesAreNullable = Expect<
  Equal<[EmployeeScopedWire["firstName"], EmployeeScopedWire["lastName"]], [string | null, string | null]>
>
type _WireEmailVerifiedIsTimestamp = Expect<Equal<ClientWire["emailVerified"], string | null>>

/** Fields that stay exactly as the wire sends them. */
type _AccountTypeIsWireVocabulary = Expect<Equal<Client["accountType"], "full" | "walk_in">>
type _GenderIsWireVocabulary = Expect<Equal<Client["gender"], "male" | "female" | null>>
type _BookingSummaryIsWire = Expect<
  Equal<Client["lastBooking"], components["schemas"]["ClientBookingSummaryDto"] | null>
>
type _StaffFieldsKeepWireTypes = Expect<
  Equal<
    [Client["nationalId"], Client["bloodType"], Client["source"]],
    [string | null | undefined, ClientWire["bloodType"] | undefined, ClientWire["source"] | undefined]
  >
>

/** What an EMPLOYEE-role caller receives: only the 16 always-present keys. */
const employeeScopedWireRow: EmployeeScopedWire = {
  id: "c1",
  ref: 7,
  name: "Sara Al-Harbi",
  firstName: "Sara",
  lastName: null,
  phone: null,
  email: null,
  dateOfBirth: null,
  gender: null,
  avatarUrl: null,
  accountType: "walk_in",
  isActive: true,
  lastBooking: null,
  nextBooking: { id: "b1", date: "2026-11-12T09:00:00.000Z", status: "CONFIRMED" },
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
}

/** What a staff caller receives: the full record. */
const staffWireRow: ClientWire = {
  ...employeeScopedWireRow,
  accountType: "full",
  userId: null,
  middleName: null,
  emailVerified: "2026-01-01T00:00:00.000Z",
  phoneVerified: null,
  nationality: null,
  nationalId: "1234567890",
  emergencyName: null,
  emergencyPhone: null,
  bloodType: "O_NEG",
  allergies: null,
  chronicConditions: null,
  notes: null,
  source: "WALK_IN",
  claimedAt: null,
  deletedAt: null,
  lastLoginAt: null,
  preferredLocale: null,
  pushEnabled: true,
  consentedAt: null,
  consentVersion: null,
}

/**
 * The documented narrowing applied at the API boundary (`toClient`). If the
 * wire stops being nullable here, this stops being a deviation and the list in
 * lib/types/client.ts must be updated.
 */
const dashboardFromEmployee: Client = {
  ...employeeScopedWireRow,
  firstName: employeeScopedWireRow.firstName ?? "",
  lastName: employeeScopedWireRow.lastName ?? "",
  emailVerified: false,
}
const dashboardFromStaff: Client = {
  ...staffWireRow,
  firstName: staffWireRow.firstName ?? "",
  lastName: staffWireRow.lastName ?? "",
  emailVerified: !!staffWireRow.emailVerified,
}

describe("client type contract", () => {
  it("keeps the dashboard entity aligned with the OpenAPI snapshot", () => {
    expect(dashboardFromEmployee.lastName).toBe("")
    expect(dashboardFromEmployee.emailVerified).toBe(false)
    expect(dashboardFromEmployee.nationalId).toBeUndefined()
    expect(dashboardFromEmployee.nextBooking?.status).toBe("CONFIRMED")
    expect(dashboardFromStaff.emailVerified).toBe(true)
    expect(dashboardFromStaff.nationalId).toBe("1234567890")
  })
})
