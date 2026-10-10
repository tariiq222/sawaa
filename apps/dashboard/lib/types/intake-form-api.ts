import type { OpenApiRequestBody, OpenApiResponse } from "@/lib/api/openapi"
import type { paths } from "@/lib/types/api.generated"
import type { FormScope, FormType, FieldType } from "./intake-form-shared"

export type { FormScope, FormType, FieldType, ConditionOperator } from "./intake-form-shared"

type FormsPath = "/api/v1/dashboard/organization/intake-forms"
type FormPath = "/api/v1/dashboard/organization/intake-forms/{formId}"
type ResponsesPath = "/api/v1/dashboard/organization/intake-forms/responses/{bookingId}"

export type IntakeFormWire = OpenApiResponse<FormPath, "get">
export type IntakeFormListWire = OpenApiResponse<FormsPath, "get">[number]
export type IntakeResponseWire = OpenApiResponse<ResponsesPath, "get">[number]
export type CreateIntakeFormWire = OpenApiRequestBody<FormsPath, "post">
export type UpdateIntakeFormWire = OpenApiRequestBody<FormPath, "patch">
export type IntakeFieldInputWire = NonNullable<CreateIntakeFormWire["fields"]>[number]

// The UI uses lowercase enums. All other wire properties come from OpenAPI.
export type IntakeFieldApi = Omit<IntakeFormWire["fields"][number], "fieldType"> & {
  fieldType: FieldType
}
export type IntakeFormApi = Omit<IntakeFormWire, "type" | "scope" | "fields"> & {
  type: FormType
  scope: FormScope
  scopeLabel?: string | null
  fields: IntakeFieldApi[]
}
export type IntakeResponseApi = Omit<IntakeResponseWire, "form"> & {
  form: IntakeFormApi & Pick<IntakeResponseWire["form"], "scopeLabel" | "serviceId" | "employeeId" | "branchId">
}

export type IntakeFormListQuery = NonNullable<paths[FormsPath]["get"]["parameters"]["query"]>
export type SetFieldItemApiPayload = Omit<IntakeFieldInputWire, "fieldType"> & { fieldType: FieldType }
export type SetFieldsApiPayload = { fields: SetFieldItemApiPayload[] }
export type CreateIntakeFormApiPayload = Omit<CreateIntakeFormWire, "type" | "scope" | "fields"> & {
  type: FormType
  scope: FormScope
  fields?: SetFieldItemApiPayload[]
}
export type UpdateIntakeFormApiPayload = Omit<UpdateIntakeFormWire, "type" | "scope" | "fields"> & {
  type?: FormType
  scope?: FormScope
  fields?: SetFieldItemApiPayload[]
}
