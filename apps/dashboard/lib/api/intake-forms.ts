/**
 * Intake Forms API — Sawaa Dashboard
 */

import { api } from "@/lib/api"
import type {
  IntakeFormApi,
  IntakeFieldApi,
  IntakeFormListQuery,
  CreateIntakeFormApiPayload,
  UpdateIntakeFormApiPayload,
  SetFieldsApiPayload,
  IntakeResponseApi,
} from "@/lib/types/intake-form-api"
import type {
  FormType,
  FormScope,
  FieldType,
} from "@/lib/types/intake-form-shared"

/* ─── Enum casing normalization ───
 * Backend Prisma enums are UPPERCASE (PRE_BOOKING / GLOBAL / TEXT) and the
 * @IsEnum validator runs under whitelist+forbidNonWhitelisted, so writes must
 * send UPPERCASE. The whole frontend works in lowercase. Normalize at this
 * boundary: UPPERCASE on write, lowercase on read — so create + list + edit
 * all agree on lowercase internally regardless of which read endpoint
 * (some lowercase server-side, some don't) served the data.
 */

function toBackendEnum<T extends string>(value: T): string {
  return value.toUpperCase()
}

function normalizeFieldFromApi(field: IntakeFieldApi): IntakeFieldApi {
  return { ...field, fieldType: field.fieldType.toLowerCase() as FieldType }
}

function normalizeFormFromApi(form: IntakeFormApi): IntakeFormApi {
  return {
    ...form,
    type: form.type.toLowerCase() as FormType,
    scope: form.scope.toLowerCase() as FormScope,
    fields: form.fields?.map(normalizeFieldFromApi) ?? [],
  }
}

/* ─── List & Get ─── */

export async function fetchIntakeForms(
  query?: IntakeFormListQuery,
): Promise<IntakeFormApi[]> {
  const forms = await api.get<IntakeFormApi[]>("/dashboard/organization/intake-forms", query as Record<string, string | boolean | undefined>)
  return forms.map(normalizeFormFromApi)
}

export async function fetchIntakeForm(formId: string): Promise<IntakeFormApi> {
  const form = await api.get<IntakeFormApi>(`/dashboard/organization/intake-forms/${formId}`)
  return normalizeFormFromApi(form)
}

/* ─── Create / Update / Delete ─── */

export async function createIntakeForm(
  payload: CreateIntakeFormApiPayload,
): Promise<IntakeFormApi> {
  const form = await api.post<IntakeFormApi>("/dashboard/organization/intake-forms", {
    ...payload,
    type: toBackendEnum(payload.type),
    scope: toBackendEnum(payload.scope),
  })
  return normalizeFormFromApi(form)
}

export async function updateIntakeForm(
  formId: string,
  payload: UpdateIntakeFormApiPayload,
): Promise<IntakeFormApi> {
  const form = await api.patch<IntakeFormApi>(`/dashboard/organization/intake-forms/${formId}`, payload)
  return normalizeFormFromApi(form)
}

/* ─── Fields ─── */

export async function setIntakeFields(
  formId: string,
  payload: SetFieldsApiPayload,
): Promise<IntakeFormApi> {
  const form = await api.put<IntakeFormApi>(`/dashboard/organization/intake-forms/${formId}/fields`, {
    fields: payload.fields.map((f) => ({
      ...f,
      fieldType: toBackendEnum(f.fieldType),
    })),
  })
  return normalizeFormFromApi(form)
}

export async function deleteIntakeForm(formId: string): Promise<void> {
  return api.delete<void>(`/dashboard/organization/intake-forms/${formId}`)
}

/* ─── Responses ─── */

export async function fetchIntakeResponses(
  bookingId: string,
): Promise<IntakeResponseApi[]> {
  const responses = await api.get<IntakeResponseApi[]>(`/dashboard/organization/intake-forms/responses/${bookingId}`)
  return responses.map((r) => ({
    ...r,
    // normalizeFormFromApi spreads `r.form`, so the enriched scope fields
    // (scopeLabel/serviceId/employeeId/branchId) on the responses form are preserved.
    form: normalizeFormFromApi(r.form) as IntakeResponseApi["form"],
  }))
}

/** Alias of {@link fetchIntakeResponses} — fetches a booking's submitted intake responses. */
export const fetchBookingIntakeResponses = fetchIntakeResponses
