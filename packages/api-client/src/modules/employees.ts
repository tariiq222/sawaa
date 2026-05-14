import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type {
  EmployeeListItem,
  EmployeeListQuery,
  EmployeeListResponse,
  EmployeeStats,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  EmployeeBreak,
  SetBreaksPayload,
  EmployeeVacation,
  CreateVacationPayload,
  EmployeeService,
  AssignEmployeeServicePayload,
  UpdateEmployeeServicePayload,
} from '../types/employee'

export async function list(
  query: EmployeeListQuery = {},
): Promise<EmployeeListResponse> {
  return apiRequest<EmployeeListResponse>(
    `/employees${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<EmployeeListItem> {
  return apiRequest<EmployeeListItem>(`/employees/${id}`)
}

export async function create(
  payload: CreateEmployeePayload,
): Promise<EmployeeListItem> {
  return apiRequest<EmployeeListItem>('/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(
  id: string,
  payload: UpdateEmployeePayload,
): Promise<EmployeeListItem> {
  return apiRequest<EmployeeListItem>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<void> {
  return apiRequest<void>(`/employees/${id}`, { method: 'DELETE' })
}

// ─── Breaks ────────────────────────────────────────────────────────────────

export async function getBreaks(employeeId: string): Promise<EmployeeBreak[]> {
  return apiRequest<EmployeeBreak[]>(`/employees/${employeeId}/breaks`)
}

export async function setBreaks(
  employeeId: string,
  payload: SetBreaksPayload,
): Promise<EmployeeBreak[]> {
  return apiRequest<EmployeeBreak[]>(`/employees/${employeeId}/breaks`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ─── Vacations ─────────────────────────────────────────────────────────────

export async function getVacations(employeeId: string): Promise<EmployeeVacation[]> {
  return apiRequest<EmployeeVacation[]>(`/employees/${employeeId}/vacations`)
}

export async function createVacation(
  employeeId: string,
  payload: CreateVacationPayload,
): Promise<EmployeeVacation> {
  return apiRequest<EmployeeVacation>(`/employees/${employeeId}/vacations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteVacation(
  employeeId: string,
  vacationId: string,
): Promise<void> {
  return apiRequest<void>(`/employees/${employeeId}/vacations/${vacationId}`, {
    method: 'DELETE',
  })
}

// ─── Services ──────────────────────────────────────────────────────────────

export async function listServices(employeeId: string): Promise<EmployeeService[]> {
  return apiRequest<EmployeeService[]>(`/employees/${employeeId}/services`)
}

export async function assignService(
  employeeId: string,
  payload: AssignEmployeeServicePayload,
): Promise<EmployeeService> {
  return apiRequest<EmployeeService>(`/employees/${employeeId}/services`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateService(
  employeeId: string,
  serviceId: string,
  payload: UpdateEmployeeServicePayload,
): Promise<EmployeeService> {
  return apiRequest<EmployeeService>(
    `/employees/${employeeId}/services/${serviceId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}

export async function removeService(
  employeeId: string,
  serviceId: string,
): Promise<void> {
  return apiRequest<void>(`/employees/${employeeId}/services/${serviceId}`, {
    method: 'DELETE',
  })
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export async function stats(): Promise<EmployeeStats> {
  const [activeRes, allRes] = await Promise.all([
    list({ isActive: true, perPage: 1 }),
    list({ perPage: 1 }),
  ])
  const active = activeRes.meta.total
  const total = allRes.meta.total
  return {
    total,
    active,
    inactive: total - active,
    newThisMonth: 0,
  }
}
