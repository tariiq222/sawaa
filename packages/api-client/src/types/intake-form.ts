import type { components } from './generated/openapi'

type Schemas = components['schemas']

/** `IntakeFormListItemResponseDto['type']` — the list projection's lower-case form enum. */
export type FormType = Schemas['IntakeFormListItemResponseDto']['type']

/** `IntakeFormListItemResponseDto['scope']` — lower-case on the list, UPPER_CASE on the detail. */
export type FormScope = Schemas['IntakeFormListItemResponseDto']['scope']

/**
 * Field shape from `IntakeFieldResponseDto`, mapped to the legacy UI shape
 * (`type` ← `fieldType`, `required` ← `isRequired`, `order` ← `position`,
 * `labelAr`/`labelEn` unchanged). The `type` vocabulary is the documented one.
 */
export type IntakeFormField = {
  id: Schemas['IntakeFieldResponseDto']['id']
  labelAr: Schemas['IntakeFieldResponseDto']['labelAr']
  labelEn: NonNullable<Schemas['IntakeFieldResponseDto']['labelEn']>
  /** Lower-cased documented `fieldType` enum (legacy UI vocabulary). */
  type: Lowercase<Schemas['IntakeFieldResponseDto']['fieldType']> &
    ('text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date')
  required: Schemas['IntakeFieldResponseDto']['isRequired']
  order: Schemas['IntakeFieldResponseDto']['position']
  /** Documented as `string[]`; kept optional so unset options stay omitted. */
  options?: string[]
}

/**
 * Row of `GET /dashboard/organization/intake-forms`
 * (`IntakeFormListItemResponseDto`), projected to the legacy keys.
 * `fieldCount` is the documented `fieldsCount`.
 */
export type IntakeFormListItem = Pick<
  Schemas['IntakeFormListItemResponseDto'],
  'id' | 'nameAr' | 'type' | 'scope' | 'isActive' | 'createdAt'
> & {
  /** Documented as nullable; the old contract required it, so it is kept required. */
  nameEn: string
  /** Documented as `fieldsCount`. */
  fieldCount: Schemas['IntakeFormListItemResponseDto']['fieldsCount']
}

/**
 * Detail from `GET /dashboard/organization/intake-forms/{formId}`
 * (`IntakeFormResponseDto`), projected to the legacy shape. The documented
 * detail replaces the old `serviceId`/`employeeId`/`branchId` triple with a
 * single `scopeId`; those three are kept as optional local projections.
 */
export type IntakeFormDetail = Omit<IntakeFormListItem, 'type' | 'scope'> & {
  /** The detail endpoint documents UPPER_CASE; lower-cased to the legacy vocabulary. */
  type: Lowercase<Schemas['IntakeFormResponseDto']['type']>
  scope: Lowercase<Schemas['IntakeFormResponseDto']['scope']>
  /** Local projection of the documented `scopeId` (legacy per-scope keys). */
  serviceId?: string
  employeeId?: string
  branchId?: string
  fields: IntakeFormField[]
}

/** Query of `GET /dashboard/organization/intake-forms`, projected to the legacy filters. */
export interface IntakeFormListQuery {
  page?: number
  limit?: number
  search?: string
  type?: FormType
  scope?: FormScope
  isActive?: boolean
}

/** Request body of `POST /dashboard/organization/intake-forms` (`CreateIntakeFormDto`), projected. */
export type CreateIntakeFormPayload = {
  nameAr: Schemas['CreateIntakeFormDto']['nameAr']
  /** Documented as nullable; the old contract required it, so it is kept required. */
  nameEn: string
  /** Documented as UPPER_CASE; the client sends the legacy lower-case enum. */
  type: FormType
  scope: FormScope
} & {
  /** Local projection of `scopeId` (legacy per-scope keys). */
  serviceId?: string
  employeeId?: string
  branchId?: string
}

/** Request body of `PATCH /dashboard/organization/intake-forms/{formId}` (`UpdateIntakeFormDto`), all optional. */
export type UpdateIntakeFormPayload = Partial<CreateIntakeFormPayload & { isActive: boolean }>
