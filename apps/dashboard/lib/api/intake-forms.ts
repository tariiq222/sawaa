import { openApi } from "@/lib/api/openapi"
import type {
  IntakeFormApi, IntakeFieldApi, IntakeFormListQuery, CreateIntakeFormApiPayload,
  UpdateIntakeFormApiPayload, SetFieldsApiPayload, IntakeResponseApi,
  IntakeFormWire, IntakeFormListWire, CreateIntakeFormWire, IntakeFieldInputWire,
  SetFieldItemApiPayload,
} from "@/lib/types/intake-form-api"
import type { FormType, FormScope, FieldType } from "@/lib/types/intake-form-shared"

const FORM_TYPE = {
  pre_booking: "PRE_BOOKING", pre_session: "PRE_SESSION",
  post_session: "POST_SESSION", registration: "REGISTRATION",
} satisfies Record<FormType, CreateIntakeFormWire["type"]>
const FORM_SCOPE = {
  global: "GLOBAL", service: "SERVICE", employee: "EMPLOYEE", branch: "BRANCH",
} satisfies Record<FormScope, CreateIntakeFormWire["scope"]>
const FIELD_TYPE = {
  text: "TEXT", textarea: "TEXTAREA", number: "NUMBER", radio: "RADIO",
  checkbox: "CHECKBOX", select: "SELECT", date: "DATE",
} satisfies Record<FieldType, IntakeFieldInputWire["fieldType"]>

const TYPE_FROM_API = {
  PRE_BOOKING: "pre_booking", PRE_SESSION: "pre_session", POST_SESSION: "post_session", REGISTRATION: "registration",
  pre_booking: "pre_booking", pre_session: "pre_session", post_session: "post_session", registration: "registration",
} satisfies Record<CreateIntakeFormWire["type"] | FormType, FormType>
const SCOPE_FROM_API = {
  GLOBAL: "global", SERVICE: "service", EMPLOYEE: "employee", BRANCH: "branch",
  global: "global", service: "service", employee: "employee", branch: "branch",
} satisfies Record<CreateIntakeFormWire["scope"] | FormScope, FormScope>
const FIELD_FROM_API = {
  TEXT: "text", TEXTAREA: "textarea", NUMBER: "number", RADIO: "radio",
  CHECKBOX: "checkbox", SELECT: "select", DATE: "date",
} satisfies Record<IntakeFieldInputWire["fieldType"], FieldType>

function normalizeField(field: IntakeFormWire["fields"][number]): IntakeFieldApi {
  return { ...field, fieldType: FIELD_FROM_API[field.fieldType] }
}

function normalizeForm(form: IntakeFormWire | IntakeFormListWire): IntakeFormApi {
  return {
    ...form, type: TYPE_FROM_API[form.type], scope: SCOPE_FROM_API[form.scope],
    fields: form.fields.map(normalizeField),
  }
}

function toWireFields(fields: SetFieldItemApiPayload[]): IntakeFieldInputWire[] {
  return fields.map((field) => ({ ...field, fieldType: FIELD_TYPE[field.fieldType] }))
}

export async function fetchIntakeForms(query?: IntakeFormListQuery): Promise<IntakeFormApi[]> {
  const forms = await openApi.get("/api/v1/dashboard/organization/intake-forms", { query })
  return forms.map(normalizeForm)
}

export async function fetchIntakeForm(formId: string): Promise<IntakeFormApi> {
  return normalizeForm(await openApi.get("/api/v1/dashboard/organization/intake-forms/{formId}", { path: { formId } }))
}

export async function createIntakeForm(payload: CreateIntakeFormApiPayload): Promise<IntakeFormApi> {
  const { type, scope, fields, ...metadata } = payload
  return normalizeForm(await openApi.post("/api/v1/dashboard/organization/intake-forms", {
    body: { ...metadata, type: FORM_TYPE[type], scope: FORM_SCOPE[scope],
      ...(fields !== undefined ? { fields: toWireFields(fields) } : {}) },
  }))
}

export async function updateIntakeForm(formId: string, payload: UpdateIntakeFormApiPayload): Promise<IntakeFormApi> {
  const { type, scope, fields, ...metadata } = payload
  return normalizeForm(await openApi.patch("/api/v1/dashboard/organization/intake-forms/{formId}", {
    path: { formId },
    body: { ...metadata,
      ...(type !== undefined ? { type: FORM_TYPE[type] } : {}),
      ...(scope !== undefined ? { scope: FORM_SCOPE[scope] } : {}),
      ...(fields !== undefined ? { fields: toWireFields(fields) } : {}),
    },
  }))
}

export async function setIntakeFields(formId: string, payload: SetFieldsApiPayload): Promise<IntakeFormApi> {
  return normalizeForm(await openApi.put("/api/v1/dashboard/organization/intake-forms/{formId}/fields", {
    path: { formId }, body: { fields: toWireFields(payload.fields) },
  }))
}

export async function deleteIntakeForm(formId: string): Promise<void> {
  return openApi.delete("/api/v1/dashboard/organization/intake-forms/{formId}", { path: { formId } })
}

export async function fetchIntakeResponses(bookingId: string): Promise<IntakeResponseApi[]> {
  const responses = await openApi.get("/api/v1/dashboard/organization/intake-forms/responses/{bookingId}", { path: { bookingId } })
  return responses.map((response) => ({
    ...response,
    form: { ...response.form, ...normalizeForm(response.form) },
  }))
}

export const fetchBookingIntakeResponses = fetchIntakeResponses
