export interface EmployeeAvailability {
  id: string
  employeeId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
  branchId: string | null
  createdAt: string
  updatedAt: string
}

export interface AvailabilitySlotInput {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive?: boolean
  branchId?: string | null
}

export interface SetAvailabilityPayload {
  schedule: AvailabilitySlotInput[]
}

export interface GetAvailabilityResponse {
  schedule: EmployeeAvailability[]
}

export interface SetAvailabilityResponse {
  success: boolean
  data: { schedule: EmployeeAvailability[] }
  message: string
}
