import type { FormType, FormScope, FieldType, ConditionOperator } from "./intake-form-shared"

export type { FormType, FormScope, FieldType, ConditionOperator } from "./intake-form-shared"

export interface FieldCondition {
  fieldId: string
  operator: ConditionOperator
  value: string
}

export interface FormField {
  id: string
  labelEn: string
  labelAr: string
  type: FieldType
  required: boolean
  options: string[]
  condition?: FieldCondition
}

export interface IntakeForm {
  id: string
  nameEn: string
  nameAr: string
  type: FormType
  scope: FormScope
  scopeId?: string
  scopeLabel: string | null
  isActive: boolean
  fieldsCount: number
  submissionsCount: number
  createdAt: string
  fields?: FormField[]
}

export interface IntakeFormDraft {
  nameEn: string
  nameAr: string
  type: FormType
  scope: FormScope
  scopeId: string
  isActive: boolean
  fields: FormField[]
}

export const FORM_TYPE_LABELS: Record<FormType, { en: string; ar: string }> = {
  pre_booking: { en: "Pre-Booking", ar: "ما قبل الحجز" },
  pre_session: { en: "Pre-Session", ar: "ما قبل الجلسة" },
  post_session: { en: "Post-Session", ar: "ما بعد الجلسة" },
  registration: { en: "Registration", ar: "التسجيل" },
}

export const FORM_SCOPE_LABELS: Record<FormScope, { en: string; ar: string }> = {
  global: { en: "All Clinic", ar: "العيادة كلها" },
  service: { en: "Service", ar: "خدمة" },
  employee: { en: "Employee", ar: "معالج" },
  branch: { en: "Branch", ar: "فرع" },
}

export const FIELD_TYPE_LABELS: Record<FieldType, { en: string; ar: string }> = {
  text: { en: "Short Text", ar: "نص قصير" },
  textarea: { en: "Long Text", ar: "نص طويل" },
  number: { en: "Number", ar: "رقم" },
  radio: { en: "Single Choice", ar: "اختيار واحد" },
  checkbox: { en: "Multiple Choice", ar: "اختيار متعدد" },
  select: { en: "Dropdown", ar: "قائمة منسدلة" },
  date: { en: "Date", ar: "تاريخ" },
  rating: { en: "Rating", ar: "تقييم" },
  file: { en: "File Upload", ar: "رفع ملف" },
}

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, { en: string; ar: string }> = {
  equals: { en: "Equals", ar: "يساوي" },
  not_equals: { en: "Not Equals", ar: "لا يساوي" },
  contains: { en: "Contains", ar: "يحتوي على" },
}
