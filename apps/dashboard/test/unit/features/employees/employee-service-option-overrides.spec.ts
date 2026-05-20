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
  it("initializes configs from service defaults in SAR-major units", () => {
    expect(makeDefaultEmployeeTypeConfigs(serviceBookingTypes)).toEqual([
      expect.objectContaining({
        deliveryType: "in_person",
        price: null,
        duration: null,
        durationOptions: [
          expect.objectContaining({ id: "opt-45", price: 150, durationMinutes: 45 }),
        ],
      }),
    ])
  })

  it("sends inactive null overrides when custom pricing is disabled", () => {
    expect(
      buildEmployeeServiceOptionsPayload({
        typeConfigs: [],
        serviceBookingTypes,
        useCustomPricing: false,
      }),
    ).toEqual({
      options: [
        {
          durationOptionId: "opt-45",
          priceOverride: null,
          durationOverride: null,
          deliveryType: "IN_PERSON",
          isActive: false,
        },
      ],
    })
  })

  it("sends active custom option overrides in integer halalas", () => {
    expect(
      buildEmployeeServiceOptionsPayload({
        typeConfigs: [
          {
            deliveryType: "in_person",
            price: 160,
            duration: 55,
            useCustomOptions: true,
            durationOptions: [
              {
                id: "opt-45",
                label: "45 minutes",
                durationMinutes: 50,
                price: 175.5,
                isDefault: true,
              },
              {
                label: "No id",
                durationMinutes: 60,
                price: 200,
              },
            ],
          },
        ],
        serviceBookingTypes,
        useCustomPricing: true,
      }),
    ).toEqual({
      options: [
        {
          durationOptionId: "opt-45",
          priceOverride: 16000,
          durationOverride: 55,
          deliveryType: "IN_PERSON",
          isActive: true,
        },
      ],
    })
  })
})
