import type { EmployeeTypeConfigPayload } from "@/lib/types/employee"
import type { ServiceBookingType } from "@/lib/types/service"

export type EmployeeServiceOptionsPayload = { options: never[] }

export function makeDefaultEmployeeTypeConfigs(
  serviceBookingTypes: ServiceBookingType[],
): EmployeeTypeConfigPayload[] {
  return serviceBookingTypes
    .filter((type) => type.isActive)
    .map((type) => ({
      deliveryType: type.deliveryType.toLowerCase(),
      price: null,
      duration: null,
      isActive: true,
    }))
}

export function buildEmployeeServiceOptionsPayload(_args: {
  typeConfigs: EmployeeTypeConfigPayload[]
}): EmployeeServiceOptionsPayload | null {
  // durationOptions UI removed — flat price/duration overrides are now handled
  // via the service assignment payload (types array). No per-option call needed.
  return null
}
