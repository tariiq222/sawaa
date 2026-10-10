import { fetchServiceEmployees } from "@/lib/api/services"
import { assignService, removeEmployeeService, updateEmployeeService } from "@/lib/api/employees-schedule"

/** Reconcile a partially created service with the current practitioner draft. */
export async function saveCreatedServiceEmployees(serviceId: string, employeeIds: string[], active: Record<string, boolean>) {
  const assigned = await fetchServiceEmployees(serviceId)
  for (const link of assigned) {
    if (!employeeIds.includes(link.employee.id)) await removeEmployeeService(link.employee.id, serviceId)
  }
  for (const employeeId of employeeIds) {
    if (!assigned.some(link => link.employee.id === employeeId)) await assignService(employeeId, {serviceId})
    await updateEmployeeService(employeeId, serviceId, {isActive: active[employeeId] !== false})
  }
}
