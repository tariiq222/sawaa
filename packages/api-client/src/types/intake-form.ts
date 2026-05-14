export type FormType = 'pre_booking' | 'pre_session' | 'post_session' | 'registration'
export type FormScope = 'global' | 'service' | 'employee' | 'branch'

export interface IntakeFormField {
  id: string
  labelAr: string
  labelEn: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date'
  required: boolean
  order: number
  options?: string[]
}

export interface IntakeFormListItem {
  id: string
  nameAr: string
  nameEn: string
  type: FormType
  scope: FormScope
  isActive: boolean
  fieldCount: number
  createdAt: string
}

export interface IntakeFormDetail extends IntakeFormListItem {
  serviceId?: string
  employeeId?: string
  branchId?: string
  fields: IntakeFormField[]
}

export interface IntakeFormListQuery {
  page?: number
  perPage?: number
  search?: string
  type?: FormType
  scope?: FormScope
  isActive?: boolean
}

export interface CreateIntakeFormPayload {
  nameAr: string
  nameEn: string
  type: FormType
  scope: FormScope
  serviceId?: string
  employeeId?: string
  branchId?: string
}

export type UpdateIntakeFormPayload = Partial<CreateIntakeFormPayload & { isActive: boolean }>
