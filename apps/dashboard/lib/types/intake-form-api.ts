/**
 * Intake Forms — API types (mirror of backend schema)
 * These match the NestJS backend response shapes exactly.
 */

import type { FormScope, FormType, FieldType } from "./intake-form-shared"

export type { FormScope, FormType, FieldType, ConditionOperator } from "./intake-form-shared"

/* ─── Entities ─── */

export interface IntakeFieldApi {
  id: string
  formId: string
  labelAr: string
  labelEn: string
  fieldType: FieldType
  options: string[] | null
  isRequired: boolean
  position: number
}

export interface IntakeFormApi {
  id: string
  nameAr: string
  nameEn: string
  type: FormType
  scope: FormScope
  scopeId: string | null
  isActive: boolean
  submissionsCount: number
  createdAt: string
  updatedAt: string
  fields: IntakeFieldApi[]
}

export interface IntakeResponseApi {
  id: string
  formId: string
  bookingId: string
  clientId: string
  answers: Record<string, string | string[]>
  createdAt: string
  /**
   * The form this response belongs to. The responses endpoint enriches the
   * base form with a computed `scopeLabel` and scope target ids, hence the
   * intersection with the optional fields below.
   */
  form: IntakeFormApi & {
    scopeLabel?: string | null
    serviceId?: string | null
    employeeId?: string | null
    branchId?: string | null
  }
}

/* ─── Query params ─── */

export interface IntakeFormListQuery {
  scope?: FormScope
  type?: FormType
  scopeId?: string
  isActive?: boolean
}

/* ─── Payloads ─── */

export interface CreateIntakeFormApiPayload {
  nameAr: string
  nameEn: string
  type: FormType
  scope: FormScope
  scopeId?: string
  isActive?: boolean
}

export interface UpdateIntakeFormApiPayload {
  nameAr?: string
  nameEn?: string
  isActive?: boolean
}

export interface SetFieldItemApiPayload {
  labelAr: string
  labelEn: string
  fieldType: FieldType
  options?: string[]
  isRequired?: boolean
  position?: number
}

export interface SetFieldsApiPayload {
  fields: SetFieldItemApiPayload[]
}
