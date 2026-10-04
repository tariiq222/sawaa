import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@sawaa/ui"

import { getServiceColumns } from "@/components/features/services/service-columns"
import { isDirectClinicBookingService } from "@/lib/service-catalog"
import type { Service } from "@/lib/types/service"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "en" }),
}))

const service = (overrides: Partial<Service> = {}): Service => ({
  id: "svc-1", ref: 1, nameAr: "خدمة", nameEn: "Service", descriptionAr: null, descriptionEn: null,
  categoryId: "cat-1", price: 100, currency: "SAR", durationMins: 60, isActive: true,
  isHidden: true, hidePriceOnBooking: false, hideDurationOnBooking: false, iconName: null,
  iconBgColor: null, imageUrl: null, bufferMinutes: 0, minLeadMinutes: null, maxAdvanceDays: null,
  depositEnabled: false, depositAmount: null, archivedAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  category: { id: "cat-1", ref: 1, nameEn: "Clinic", nameAr: "عيادة", sortOrder: 0, isActive: true,
    departmentId: null, bookingMode: "DIRECT", iconName: null, iconBgColor: null, imageUrl: null, createdAt: "2026-01-01" },
  ...overrides,
})

function renderActions(row: Service, onEdit?: (value: Service) => void, onDelete?: (value: Service) => void) {
  const columns = getServiceColumns("en", onEdit, onDelete, undefined, (key) => key)
  const actions = columns.find((column) => column.id === "actions")!
  const cell = actions.cell as (context: { row: { original: Service } }) => React.ReactNode
  return render(<TooltipProvider>{cell({ row: { original: row } })}</TooltipProvider>)
}

function renderName(row: Service) {
  const columns = getServiceColumns("en", undefined, undefined, undefined, (key) => key)
  const name = columns.find((column) => column.id === "name")!
  const cell = name.cell as (context: { row: { original: Service } }) => React.ReactNode
  return render(<>{cell({ row: { original: row } })}</>)
}

describe("service catalog presentation", () => {
  it("recognizes only hidden direct clinic booking rows as internal", () => {
    expect(isDirectClinicBookingService({ isHidden: true, category: { bookingMode: "DIRECT" } })).toBe(true)
    expect(isDirectClinicBookingService({ isHidden: true, category: { bookingMode: "SERVICES" } })).toBe(false)
    expect(isDirectClinicBookingService({ isHidden: false, category: { bookingMode: "DIRECT" } })).toBe(false)
    expect(isDirectClinicBookingService({ isHidden: true, category: null })).toBe(false)
  })

  it("shows the internal clinic booking marker and suppresses delete while preserving authorized edit", () => {
    renderActions(service(), vi.fn(), vi.fn())
    expect(screen.queryByRole("button", { name: "services.action.delete" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "services.action.edit" })).toBeInTheDocument()
    renderName(service())
    expect(screen.getByText("services.clinicBooking")).toBeInTheDocument()
  })

  it("keeps ordinary hidden SERVICES rows deletable", () => {
    renderActions(service({ category: { ...service().category!, bookingMode: "SERVICES" } }), undefined, vi.fn())
    expect(screen.getByRole("button", { name: "services.action.delete" })).toBeInTheDocument()
  })

  it("does not render edit or delete buttons when callbacks are omitted", () => {
    renderActions(service())
    expect(screen.queryByRole("button", { name: "services.action.edit" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "services.action.delete" })).not.toBeInTheDocument()
  })
})
