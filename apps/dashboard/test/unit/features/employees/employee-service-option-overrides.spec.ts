import { describe, expect, it } from "vitest"

import {
  buildEmployeeServiceOptionsPayload,
  makeDefaultEmployeeTypeConfigs,
} from "@/components/features/employees/employee-service-option-overrides"
import type { ServiceBookingType } from "@/lib/types/service"

const serviceBookingTypes: ServiceBookingType[] = [
  {
    id: "bt-1",
    serviceId: "svc-1",
    deliveryType: "IN_PERSON",
    price: 15000,
    durationMins: 45,
    isActive: true,
    useCustomAvailability: false,
    availabilityWindows: [],
    durationOptions: [
      {
        id: "opt-45",
        serviceId: "svc-1",
        label: "45 minutes",
        labelAr: "٤٥ دقيقة",
        durationMins: 45,
        price: 15000,
        currency: "SAR",
        isDefault: true,
        sortOrder: 0,
      },
    ],
  },
]

describe("employee service option overrides", () => {
  it("initializes configs from service defaults — flat price/duration, no durationOptions", () => {
    expect(makeDefaultEmployeeTypeConfigs(serviceBookingTypes)).toEqual([
      {
        deliveryType: "in_person",
        price: null,
        duration: null,
        isActive: true,
      },
    ])
  })

  it("always returns null — durationOptions UI removed", () => {
    expect(
      buildEmployeeServiceOptionsPayload({
        typeConfigs: [
          {
            deliveryType: "in_person",
            price: null,
            duration: null,
            isActive: true,
          },
        ],
      }),
    ).toBeNull()
  })

  it("always returns null even when typeConfigs have custom options", () => {
    expect(
      buildEmployeeServiceOptionsPayload({
        typeConfigs: [
          {
            deliveryType: "in_person",
            price: 160,
            duration: 55,
            useCustomOptions: true,
            isActive: true,
            durationOptions: [
              {
                id: "opt-45",
                label: "45 minutes",
                durationMinutes: 50,
                price: 175.5,
                isDefault: true,
                sortOrder: 0,
              },
            ],
          },
        ],
      }),
    ).toBeNull()
  })
})
