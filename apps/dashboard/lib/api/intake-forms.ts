/**
 * Intake Forms API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type {
  IntakeFormApi,
  IntakeFormListQuery,
  CreateIntakeFormApiPayload,
  UpdateIntakeFormApiPayload,
  SetFieldsApiPayload,
  IntakeResponseApi,
} from "@/lib/types/intake-form-api"

/* ─── List & Get ─── */

export async function fetchIntakeForms(
  query?: IntakeFormListQuery,
): Promise<IntakeFormApi[]> {
  return api.get<IntakeFormApi[]>("/dashboard/organization/intake-forms", query as Record<string, string | boolean | undefined>)
}

export async function fetchIntakeForm(formId: string): Promise<IntakeFormApi> {
  return api.get<IntakeFormApi>(`/dashboard/organization/intake-forms/${formId}`)
}

/* ─── Create / Update / Delete ─── */

export async function createIntakeForm(
  payload: CreateIntakeFormApiPayload,
): Promise<IntakeFormApi> {
  // Backend model currently only persists nameAr/nameEn/isActive + fields.
  // type/scope/serviceId/employeeId/branchId are UI-level concepts until the
  // backend schema gains matching columns — dropping them at the boundary
  // keeps the form usable without 400s.
  const body = {
    nameAr: payload.nameAr,
    nameEn: payload.nameEn,
    isActive: payload.isActive,
  }
  return api.post<IntakeFormApi>("/dashboard/organization/intake-forms", body)
}

export async function updateIntakeForm(
  formId: string,
  payload: UpdateIntakeFormApiPayload,
): Promise<IntakeFormApi> {
  return api.patch<IntakeFormApi>(`/dashboard/organization/intake-forms/${formId}`, payload)
}

/* ─── Fields ─── */

export async function setIntakeFields(
  formId: string,
  payload: SetFieldsApiPayload,
): Promise<IntakeFormApi["fields"]> {
  return api.put<IntakeFormApi["fields"]>(`/dashboard/organization/intake-forms/${formId}/fields`, payload)
}

export async function deleteIntakeForm(formId: string): Promise<void> {
  return api.delete<void>(`/dashboard/organization/intake-forms/${formId}`)
}

/* ─── Responses ─── */

export async function fetchIntakeResponses(
  bookingId: string,
): Promise<IntakeResponseApi[]> {
  return api.get<IntakeResponseApi[]>(`/dashboard/organization/intake-forms/responses/${bookingId}`)
}
