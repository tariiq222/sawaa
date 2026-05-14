/**
 * Clinic Settings API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type {
  OrganizationSettings,
  UpdateOrganizationSettingsPayload,
  PublicOrganizationSettings,
} from "@/lib/types/organization-settings"

/* ─── Queries ─── */

export async function fetchOrganizationSettings(): Promise<OrganizationSettings> {
  return api.get<OrganizationSettings>("/dashboard/organization/settings")
}

export async function fetchOrganizationSettingsPublic(): Promise<PublicOrganizationSettings> {
  return api.get<PublicOrganizationSettings>("/dashboard/organization/settings")
}

/* ─── Mutations ─── */

export async function updateOrganizationSettings(
  data: UpdateOrganizationSettingsPayload,
): Promise<OrganizationSettings> {
  return api.patch<OrganizationSettings>("/dashboard/organization/settings", data)
}

/* ─── Booking Flow Order ─── */

export type BookingFlowOrder = "service_first" | "employee_first" | "both"

export async function fetchBookingFlowOrder(): Promise<BookingFlowOrder> {
  const res = await api.get<{ bookingFlowOrder: BookingFlowOrder }>("/dashboard/organization/settings")
  return res.bookingFlowOrder ?? "service_first"
}

export async function updateBookingFlowOrder(
  order: BookingFlowOrder,
): Promise<BookingFlowOrder> {
  const res = await api.patch<{ bookingFlowOrder: BookingFlowOrder }>("/dashboard/organization/settings", {
    bookingFlowOrder: order,
  })
  return res.bookingFlowOrder ?? "service_first"
}

/* ─── Payment Settings ─── */

export interface PaymentSettings {
  paymentMoyasarEnabled: boolean
  paymentAtClinicEnabled: boolean
}

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  const res = await api.get<PaymentSettings>("/dashboard/organization/settings")
  return { paymentMoyasarEnabled: res.paymentMoyasarEnabled, paymentAtClinicEnabled: res.paymentAtClinicEnabled }
}

export async function updatePaymentSettings(
  settings: Partial<PaymentSettings>,
): Promise<PaymentSettings> {
  const res = await api.patch<PaymentSettings>("/dashboard/organization/settings", settings)
  return { paymentMoyasarEnabled: res.paymentMoyasarEnabled, paymentAtClinicEnabled: res.paymentAtClinicEnabled }
}
