import { halalasToSarNumber, sarToHalalas } from "@/lib/money"
import type { EmployeeServiceType, EmployeeTypeConfigPayload } from "@/lib/types/employee"
import type { ServiceBookingType, ServiceDeliveryType } from "@/lib/types/service"

type EmployeeOptionPayload = {
  durationOptionId: string
  priceOverride: number | null
  durationOverride: number | null
  deliveryType?: ServiceDeliveryType
  isActive?: boolean
}

export type EmployeeServiceOptionsPayload = { options: EmployeeOptionPayload[] }

function toUiDeliveryType(deliveryType: string) {
  return deliveryType.toLowerCase()
}

function toApiDeliveryType(deliveryType: string): ServiceDeliveryType | undefined {
  const normalized = deliveryType.toUpperCase()
  if (normalized === "IN_PERSON" || normalized === "ONLINE") {
    return normalized
  }
  if (deliveryType === "in_person") return "IN_PERSON"
  if (deliveryType === "online") return "ONLINE"
  return undefined
}

export function makeDefaultEmployeeTypeConfigs(
  serviceBookingTypes: ServiceBookingType[],
): EmployeeTypeConfigPayload[] {
  return serviceBookingTypes
    .filter((type) => type.isActive)
    .map((type) => ({
      deliveryType: toUiDeliveryType(type.deliveryType),
      price: null,
      duration: null,
      useCustomOptions: false,
      isActive: true,
      durationOptions: type.durationOptions.map((option) => ({
        id: option.id,
        label: option.label,
        labelAr: option.labelAr ?? undefined,
        durationMinutes: option.durationMins,
        price: halalasToSarNumber(option.price),
        isDefault: option.isDefault,
        sortOrder: option.sortOrder,
      })),
    }))
}

export function hasCustomEmployeeServiceOptions(
  employeeTypes: EmployeeServiceType[],
  serviceBookingTypes: ServiceBookingType[],
) {
  const serviceOptionById = new Map(
    serviceBookingTypes.flatMap((type) =>
      type.durationOptions.map((option) => [option.id, option] as const),
    ),
  )

  return employeeTypes.some((type) =>
    type.durationOptions.some((option) => {
      const serviceOption = serviceOptionById.get(option.id)
      if (!serviceOption) return false
      return (
        option.price !== serviceOption.price ||
        option.durationMinutes !== serviceOption.durationMins
      )
    }),
  )
}

export function buildEmployeeServiceOptionsPayload({
  typeConfigs,
  serviceBookingTypes,
  useCustomPricing,
}: {
  typeConfigs: EmployeeTypeConfigPayload[]
  serviceBookingTypes?: ServiceBookingType[]
  useCustomPricing: boolean
}): EmployeeServiceOptionsPayload | null {
  const options: EmployeeOptionPayload[] = []

  if (!useCustomPricing) {
    const defaults = serviceBookingTypes?.length
      ? makeDefaultEmployeeTypeConfigs(serviceBookingTypes)
      : typeConfigs

    for (const typeConfig of defaults) {
      for (const option of typeConfig.durationOptions ?? []) {
        if (!option.id) continue
        options.push({
          durationOptionId: option.id,
          priceOverride: null,
          durationOverride: null,
          deliveryType: toApiDeliveryType(typeConfig.deliveryType),
          isActive: false,
        })
      }
    }

    return options.length > 0 ? { options } : null
  }

  for (const typeConfig of typeConfigs) {
    for (const option of typeConfig.durationOptions ?? []) {
      if (!option.id) continue
      const price = option.isDefault && typeConfig.price != null
        ? typeConfig.price
        : option.price
      const duration = option.isDefault && typeConfig.duration != null
        ? typeConfig.duration
        : option.durationMinutes
      options.push({
        durationOptionId: option.id,
        priceOverride: sarToHalalas(price),
        durationOverride: duration,
        deliveryType: toApiDeliveryType(typeConfig.deliveryType),
        isActive: true,
      })
    }
  }

  return options.length > 0 ? { options } : null
}
