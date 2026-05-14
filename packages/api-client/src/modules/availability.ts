import { apiRequest } from '../client'
import type {
  GetAvailabilityResponse,
  SetAvailabilityPayload,
  SetAvailabilityResponse,
  EmployeeAvailability,
} from '../types/availability'

export async function get(
  employeeId: string,
): Promise<EmployeeAvailability[]> {
  const res = await apiRequest<GetAvailabilityResponse>(
    `/employees/${employeeId}/availability`,
  )
  return res.schedule
}

export async function update(
  employeeId: string,
  payload: SetAvailabilityPayload,
): Promise<EmployeeAvailability[]> {
  const res = await apiRequest<SetAvailabilityResponse>(
    `/employees/${employeeId}/availability`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
  return res.data.schedule
}
