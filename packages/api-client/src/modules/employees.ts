import { apiRequest } from '../client'
import type {
  EmployeeListItem,
  EmployeeListQuery,
  EmployeeListResponse,
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

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function listEmployees(
  query: EmployeeListQuery = {},
): Promise<EmployeeListResponse> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.perPage,
    isActive: query.isActive,
  })
  return apiRequest<EmployeeListResponse>(`/dashboard/people/employees${qs}`)
}

export async function getEmployee(id: string): Promise<EmployeeListItem> {
  return apiRequest<EmployeeListItem>(`/dashboard/people/employees/${id}`)
}

export async function createEmployee(
  payload: CreateEmployeePayload,
): Promise<EmployeeListItem> {
  return apiRequest<EmployeeListItem>('/dashboard/people/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
): Promise<EmployeeListItem> {
  return apiRequest<EmployeeListItem>(`/dashboard/people/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteEmployee(id: string): Promise<void> {
  return apiRequest<void>(`/dashboard/people/employees/${id}`, {
    method: 'DELETE',
  })
}

// ─── Breaks ─────────────────────────────────────────────────────────────────

export async function getEmployeeBreaks(
  employeeId: string,
): Promise<EmployeeBreak[]> {
  return apiRequest<EmployeeBreak[]>(
    `/dashboard/people/employees/${employeeId}/breaks`,
  )
}

export async function setEmployeeBreaks(
  employeeId: string,
  payload: SetBreaksPayload,
): Promise<EmployeeBreak[]> {
  return apiRequest<EmployeeBreak[]>(
    `/dashboard/people/employees/${employeeId}/breaks`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
}

// ─── Vacations ──────────────────────────────────────────────────────────────

export async function getEmployeeVacations(
  employeeId: string,
): Promise<EmployeeVacation[]> {
  return apiRequest<EmployeeVacation[]>(
    `/dashboard/people/employees/${employeeId}/vacations`,
  )
}

export async function createEmployeeVacation(
  employeeId: string,
  payload: CreateVacationPayload,
): Promise<EmployeeVacation> {
  return apiRequest<EmployeeVacation>(
    `/dashboard/people/employees/${employeeId}/vacations`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function deleteEmployeeVacation(
  employeeId: string,
  vacationId: string,
): Promise<void> {
  return apiRequest<void>(
    `/dashboard/people/employees/${employeeId}/vacations/${vacationId}`,
    {
      method: 'DELETE',
    },
  )
}

// ─── Services ───────────────────────────────────────────────────────────────

export async function getEmployeeServices(
  employeeId: string,
): Promise<EmployeeService[]> {
  return apiRequest<EmployeeService[]>(
    `/dashboard/people/employees/${employeeId}/services`,
  )
}

export async function assignEmployeeService(
  employeeId: string,
  payload: AssignEmployeeServicePayload,
): Promise<EmployeeService> {
  return apiRequest<EmployeeService>(
    `/dashboard/people/employees/${employeeId}/services`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function updateEmployeeService(
  employeeId: string,
  serviceId: string,
  payload: UpdateEmployeeServicePayload,
): Promise<EmployeeService> {
  return apiRequest<EmployeeService>(
    `/dashboard/people/employees/${employeeId}/services/${serviceId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}
