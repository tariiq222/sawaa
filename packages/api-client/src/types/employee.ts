import type { components, paths } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'

type Schemas = components['schemas']
type EmployeeResponse = Schemas['EmployeeResponseDto']
type EmployeeWidgets = Pick<EmployeeResponse, 'id' | 'isActive'> & {
  // Documented as required; the old exported contract marked these optional,
  // which is preserved so existing consumers keep compiling.
  isPublic?: EmployeeResponse['isPublic']
  slug?: EmployeeResponse['slug']
  publicBioAr?: EmployeeResponse['publicBioAr']
  publicBioEn?: EmployeeResponse['publicBioEn']
  publicImageUrl?: EmployeeResponse['publicImageUrl']
  avatarUrl?: EmployeeResponse['avatarUrl']
}

/**
 * Row for `GET /api/v1/dashboard/people/employees` (`EmployeeResponseDto`),
 * projected to the keys this client exposes. `user` is a synthetic projection:
 * the documented row has no nested `user` object, so the four user fields are
 * assembled from the row's `name`/`email`/`phone`/`avatarUrl`. `rating` and
 * `reviewCount` are the legacy aliases of the documented `averageRating` /
 * `ratingCount`.
 */
export type EmployeeListItem = EmployeeWidgets & {
  /** Legacy alias of `averageRating`; 0 when unrated. */
  rating: NonNullable<EmployeeResponse['averageRating']> | 0
  /** Legacy alias of `ratingCount`. */
  reviewCount: EmployeeResponse['ratingCount']
  experience: NonNullable<EmployeeResponse['experience']> | 0
  bio: EmployeeResponse['bio']
  bioAr: EmployeeResponse['bioAr']
  createdAt: EmployeeResponse['createdAt']
  /** Synthetic projection assembled from the row's flat name/email/phone. */
  user: {
    id: NonNullable<EmployeeResponse['userId']>
    firstName: string
    lastName: string
    email: NonNullable<EmployeeResponse['email']>
    phone: EmployeeResponse['phone']
    avatarUrl: EmployeeResponse['avatarUrl']
  }
  specialty: EmployeeResponse['specialty']
  specialtyAr: EmployeeResponse['specialtyAr']
}

/** 200 body of `GET /dashboard/people/employees/stats` (`EmployeeStatsResponseDto`), projected. */
export type EmployeeStats = Pick<
  Schemas['EmployeeStatsResponseDto'],
  'total' | 'active' | 'inactive'
> & {
  /** Legacy key; the documented DTO reports `avgRating` instead. */
  newThisMonth: number
}

/** Query of the list operation, projected to paging + `isActive`. */
export type EmployeeListQuery = PaginationParams & {
  isActive?: NonNullable<
    paths['/api/v1/dashboard/people/employees']['get']['parameters']['query']
  >['isActive']
}

/**
 * NOT derived: `POST /dashboard/people/employees` documents `CreateEmployeeDto`
 * (`name`, `serviceIds`, `branchIds`, …). This legacy payload uses
 * `userId`/`specialty`/`experience`, a different contract. Kept hand-written.
 */
export interface CreateEmployeePayload {
  userId: string
  specialty: string
  specialtyAr?: string
  experience: number
  bio?: string
  bioAr?: string
}

/** Request body of `PATCH /dashboard/people/employees/{id}` (`UpdateEmployeeDto`), projected. */
export type UpdateEmployeePayload = {
  specialty?: string
  specialtyAr?: string
  experience?: NonNullable<Schemas['UpdateEmployeeDto']['experience']>
  bio?: string
  bioAr?: string
  isActive?: NonNullable<Schemas['UpdateEmployeeDto']['isActive']>
}

export type EmployeeListResponse = PaginatedResponse<EmployeeListItem>

// ─── Breaks ────────────────────────────────────────────────────────────────

/**
 * `EmployeeBreaksResponseDto.breaks[]` (`EmployeeBreakRecordDto`), projected
 * to the keys this legacy type exposed (the documented row also carries
 * `createdAt`/`updatedAt`).
 */
export type EmployeeBreak = Pick<
  Schemas['EmployeeBreakRecordDto'],
  'id' | 'employeeId' | 'dayOfWeek' | 'startTime' | 'endTime'
>

/** One entry of `PUT …/breaks` (`BreakWindowDto`). */
export type BreakSlotInput = Schemas['BreakWindowDto']

/** Request body of `PUT /dashboard/people/employees/{id}/breaks`. */
export type SetBreaksPayload = Schemas['SetEmployeeBreaksDto']

// ─── Vacations ─────────────────────────────────────────────────────────────

/**
 * `GET …/vacations[]` (`EmployeeAvailabilityExceptionRecordDto`), projected to
 * the keys this legacy type exposed (drops `endTime`/`isStartTimeOnly`).
 */
export type EmployeeVacation = Pick<
  Schemas['EmployeeAvailabilityExceptionRecordDto'],
  'id' | 'employeeId' | 'startDate' | 'endDate' | 'reason' | 'createdAt'
>

/** Request body of `POST …/vacations` (`CreateEmployeeExceptionDto`), projected. */
export type CreateVacationPayload = Pick<
  Schemas['CreateEmployeeExceptionDto'],
  'startDate' | 'endDate' | 'reason'
>

// ─── Employee Services ─────────────────────────────────────────────────

/**
 * One duration option. Derived from `EmployeeServiceTypeDurationOptionDto`
 * (`GET …/services/{serviceId}/types`), projected to the legacy shape:
 * `labelAr` stays nullable and the legacy `deliveryType` is re-added because
 * the documented option nestles it on the parent config instead.
 */
export type EmployeeDurationOption = Omit<
  Schemas['EmployeeServiceTypeDurationOptionDto'],
  'labelAr' | 'employeeServiceTypeId' | 'isActive'
> & {
  /** Documented as required string; kept nullable per the old contract. */
  labelAr: string | null
  /** Legacy field; the documented option carries it on the parent config. */
  deliveryType: Schemas['EmployeeServiceTypeDto']['deliveryType']
  // Documented as required; kept optional so the legacy shape stays open.
  employeeServiceTypeId?: string
  isActive?: boolean
}

/**
 * Per delivery-type config. Derived from `EmployeeServiceTypeDto`, with the
 * legacy nullable `price`/`duration` preserved and `durationOptions`
 * re-typed to `EmployeeDurationOption`.
 */
export type EmployeeTypeConfig = Omit<
  Schemas['EmployeeServiceTypeDto'],
  'price' | 'duration' | 'durationOptions' | 'bookingType' | 'employeeServiceId'
> & {
  /** Documented as number; kept nullable per the old contract. */
  price: number | null
  /** Documented as number; kept nullable per the old contract. */
  duration: number | null
  durationOptions: EmployeeDurationOption[]
  // Documented as required; kept optional so the legacy shape stays open.
  bookingType?: string
  employeeServiceId?: string
}

/**
 * Row of `GET /dashboard/people/employees/{id}/services`
 * (`EmployeeAssignedServiceDto`), plus the legacy projection keys that the
 * flat documented row does not carry (`customDuration`, `availableTypes`,
 * `types`). `service` is narrowed to the four display fields the old type
 * exposed (`duration` is the documented `durationMins`).
 */
export type EmployeeService = Pick<
  Schemas['EmployeeAssignedServiceDto'],
  'id' | 'employeeId' | 'serviceId' | 'bufferMinutes' | 'isActive'
> & {
  /** Legacy alias of per-type durations; the documented row has no such field. */
  customDuration: number | null
  /** Legacy alias derived from `disabledDeliveryTypes` (enabled ones). */
  availableTypes: string[]
  service: {
    id: Schemas['ServiceRecordDto']['id']
    nameAr: Schemas['ServiceRecordDto']['nameAr']
    /** Documented as nullable; the old contract required it, so it stays required. */
    nameEn: string
    /** Documented as a decimal string; the legacy projection used a number. */
    price: number
    duration: Schemas['ServiceRecordDto']['durationMins']
  }
  /** Per delivery-type configs (`GET …/services/{serviceId}/types`), fetched separately. */
  types: EmployeeTypeConfig[]
}

/**
 * NOT derived: `POST …/services` documents a body of just `{ serviceId }`, and
 * the pricing/type options are written through separate PUT endpoints. This
 * legacy payload is a client-side aggregate, so it stays hand-written.
 */
export interface AssignEmployeeServicePayload {
  serviceId: string
  customDuration?: number
  bufferMinutes?: number
  availableTypes: string[]
  isActive?: boolean
  types?: EmployeeTypeConfigInput[]
}

/** NOT derived: `PATCH …/services/{serviceId}` documents no request body (see above). */
export interface UpdateEmployeeServicePayload {
  customDuration?: number | null
  bufferMinutes?: number
  availableTypes?: string[]
  isActive?: boolean
  types?: EmployeeTypeConfigInput[]
}

/**
 * NOT derived: the per-type write is split across dedicated PUT endpoints
 * (`…/delivery-types`, `…/durations`, `…/options`), none of which document
 * this combined nested shape. Kept hand-written.
 */
export interface EmployeeTypeConfigInput {
  /** Delivery channel (IN_PERSON or ONLINE) */
  deliveryType: 'IN_PERSON' | 'ONLINE'
  price?: number | null
  duration?: number | null
  useCustomOptions?: boolean
  isActive?: boolean
  durationOptions?: {
    label: string
    labelAr?: string
    durationMinutes: number
    price: number
    isDefault?: boolean
    sortOrder?: number
    /** Delivery channel for this option */
    deliveryType: 'IN_PERSON' | 'ONLINE'
  }[]
}
