/**
 * Clinic Settings API — Sawaa Dashboard
 *
 * Every call goes through the typed helper in `lib/api/openapi.ts`, so a
 * renamed route or changed payload is a type error here. Response types come
 * from the committed OpenAPI snapshot (`lib/types/organization-settings.ts`).
 */

import { api } from "@/lib/api"
import type { components } from "@/lib/types/api.generated"
import { openApi } from "@/lib/api/openapi"
import type {
  OrganizationSettings,
  UpdateOrganizationSettingsPayload,
} from "@/lib/types/organization-settings"

type Schemas = components["schemas"]

/* ─── Queries ─── */

/**
 * GET `/settings` documents `OrganizationSettingsResponseDto | null`: a fresh
 * install has no settings row, and the dashboard has always treated that as
 * "no data" (every reader uses `settings?.field ?? fallback`). The type keeps
 * the null so no caller can dereference it unknowingly.
 */
export async function fetchOrganizationSettings(): Promise<OrganizationSettings | null> {
  return openApi.get("/api/v1/dashboard/organization/settings")
}

/* ─── Mutations ─── */

export async function updateOrganizationSettings(
  data: UpdateOrganizationSettingsPayload,
): Promise<OrganizationSettings> {
  // `UpsertOrgSettingsDto` accepts `null` on several string fields to clear the
  // column, but OpenAPI documents them as plain optional strings, so the body
  // is passed through the untyped client rather than the generated request type.
  return api.patch<OrganizationSettings>("/dashboard/organization/settings", data)
}

/* ─── Booking Flow Order ─── */

export type BookingFlowOrder = "service_first" | "employee_first" | "both"

export async function fetchBookingFlowOrder(): Promise<BookingFlowOrder> {
  // GET documents `… | null`; before this change the dereference below simply
  // threw when the body was empty, and no caller ever observed a default, so
  // that is preserved rather than turned into a silent fallback.
  const res = (await openApi.get("/api/v1/dashboard/organization/settings")) as OrganizationSettings
  // The column is a free-form string; the dashboard only writes the three
  // documented values and has always defaulted anything else.
  return (res.bookingFlowOrder as BookingFlowOrder | undefined) ?? "service_first"
}

export async function updateBookingFlowOrder(
  order: BookingFlowOrder,
): Promise<BookingFlowOrder> {
  const res = await openApi.patch("/api/v1/dashboard/organization/settings", {
    body: { bookingFlowOrder: order },
  })
  return (res.bookingFlowOrder as BookingFlowOrder | undefined) ?? "service_first"
}

/* ─── Payment Settings ─── */

/**
 * The payment slice of the settings row.
 *
 * The six method flags are always present on the wire; the bank-transfer pair
 * stays optional because that is how every read site already treats it
 * (`pickPaymentSettings` fills both in, but callers guard them as optional).
 */
export type PaymentSettings = Pick<
  Schemas["OrganizationSettingsResponseDto"],
  | "paymentMoyasarEnabled"
  | "paymentAtClinicEnabled"
  | "payMethodCashEnabled"
  | "payMethodBankEnabled"
  | "payMethodMadaEnabled"
  | "payMethodTabbyEnabled"
> & {
  paymentBankTransferEnabled?: boolean
  bankTransferAccounts?: Schemas["BankTransferAccountResponseDto"][]
}

/** The dashboard has always rendered absent payment fields as "off". */
function pickPaymentSettings(res: PaymentSettings): PaymentSettings {
  return {
    paymentMoyasarEnabled: res.paymentMoyasarEnabled,
    paymentAtClinicEnabled: res.paymentAtClinicEnabled,
    payMethodCashEnabled: res.payMethodCashEnabled,
    payMethodBankEnabled: res.payMethodBankEnabled,
    payMethodMadaEnabled: res.payMethodMadaEnabled,
    payMethodTabbyEnabled: res.payMethodTabbyEnabled,
    paymentBankTransferEnabled: res.paymentBankTransferEnabled ?? false,
    bankTransferAccounts: res.bankTransferAccounts ?? [],
  }
}

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  // Same note as `fetchBookingFlowOrder`: an empty body threw here before and
  // still does, because every caller already guards on `data === undefined`.
  const res = (await openApi.get("/api/v1/dashboard/organization/settings")) as OrganizationSettings
  return pickPaymentSettings(res)
}

export async function updatePaymentSettings(
  settings: Partial<PaymentSettings>,
): Promise<PaymentSettings> {
  const res = await openApi.patch("/api/v1/dashboard/organization/settings", {
    body: settings,
  })
  return pickPaymentSettings(res)
}
