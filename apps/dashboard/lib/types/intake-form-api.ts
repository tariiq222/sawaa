/**
 * Intake Forms — API types (mirror of backend schema)
 * These match the NestJS backend response shapes exactly.
 */

import type { FormScope, FormType, FieldType, ConditionOperator } from "./intake-form-shared"

export type { FormScope, FormType, FieldType, ConditionOperator } from "./intake-form-shared"

/* ─── Entities ─── */

export interface FieldConditionApi {
  fieldId: string
  operator: ConditionOperator
  value: string
}

export interface IntakeFieldApi {
  id: string
  formId: string
  labelAr: string
  labelEn: string
  fieldType: FieldType
  options: string[] | null
  condition: FieldConditionApi | null
  isRequired: boolean
  sortOrder: number
}

export interface IntakeFormApi {
  id: string
  nameAr: string
  nameEn: string
  type: FormType
  scope: FormScope
  serviceId: string | null
  employeeId: string | null
  branchId: string | null
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
  form: IntakeFormApi
}

/* ─── Query params ─── */

export interface IntakeFormListQuery {
  scope?: FormScope
  type?: FormType
  serviceId?: string
  employeeId?: string
  branchId?: string
  isActive?: boolean
}

/* ─── Payloads ─── */

export interface CreateIntakeFormApiPayload {
  nameAr: string
  nameEn: string
  type: FormType
  scope: FormScope
  serviceId?: string
  employeeId?: string
  branchId?: string
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
  condition?: FieldConditionApi
  isRequired?: boolean
  sortOrder?: number
}

export interface SetFieldsApiPayload {
  fields: SetFieldItemApiPayload[]
}
