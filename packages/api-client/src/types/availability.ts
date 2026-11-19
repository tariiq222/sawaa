import type { components } from './generated/openapi'

type Schemas = components['schemas']
type WindowRecord = Schemas['EmployeeAvailabilityWindowRecordDto']

/**
 * One schedule window. Derived from `EmployeeAvailabilityWindowRecordDto`
 * (`GET /dashboard/people/employees/{id}/availability` → `schedule[]`),
 * projected to the legacy shape. `branchId` is a local extra: the documented
 * window has no branch scope (it is a legacy UI field), declared below.
 */
export type EmployeeAvailability = Pick<
  WindowRecord,
  'id' | 'employeeId' | 'dayOfWeek' | 'startTime' | 'endTime' | 'isActive' | 'createdAt' | 'updatedAt'
> & {
  /** Not on the documented window; legacy per-branch scoping field. */
  branchId: string | null
}

/**
 * One entry of `PATCH …/availability` (`UpdateAvailabilityDto.windows[]` =
 * `AvailabilityWindow`), plus the legacy optional `branchId`.
 */
export type AvailabilitySlotInput = Schemas['AvailabilityWindow'] & {
  /** Not on the documented `AvailabilityWindow`; legacy per-branch scoping field. */
  branchId?: string | null
}

/** Request body of `PATCH /dashboard/people/employees/{id}/availability`. */
export type SetAvailabilityPayload = {
  schedule: AvailabilitySlotInput[]
}

/** 200 body of `GET …/availability` (`EmployeeScheduleResponseDto`), `schedule` re-typed to the legacy window. */
export interface GetAvailabilityResponse {
  schedule: EmployeeAvailability[]
}

/** 200 body of `PATCH …/availability` (`EmployeeAvailabilityUpdateResponseDto`), `schedule` re-typed. */
export interface SetAvailabilityResponse {
  success: boolean
  data: { schedule: EmployeeAvailability[] }
  message: string
}
