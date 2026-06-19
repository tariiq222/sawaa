import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EmployeeCustomPricingRow } from "@/components/features/services/employee-custom-pricing-row"
import type { ServiceEmployee } from "@/lib/types/service"
import type { SetPractitionerDurationsPayload } from "@/lib/api/employees"

// Mock useLocale
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "ar", t: (k: string) => k, isAr: true }),
}))

// Minimal i18n t stub
const t = (key: string) => key

function makeEmployee(
  effectiveDurations: ServiceEmployee["effectiveDurations"],
  availableTypes: string[] = [],
): ServiceEmployee {
  return {
    id: "emp-svc-1",
    employee: {
      id: "emp-1",
      nameAr: "أحمد",
      title: null,
      avatarUrl: null,
      isActive: true,
      user: { firstName: "Ahmed", lastName: "Ali" },
    },
    serviceTypes: [],
    customDuration: null,
    bufferMinutes: 0,
    availableTypes,
    isActive: true,
    hasCustomPricing: false,
    effectiveDurations,
  }
}

describe("EmployeeCustomPricingRow", () => {
  const onSave = vi.fn()

  beforeEach(() => {
    onSave.mockClear()
  })

  it("renders inherited badge when isInherited=true", () => {
    const item = makeEmployee(
      [
        {
          deliveryType: "IN_PERSON",
          durations: [
            {
              id: "dur-1",
              deliveryType: "IN_PERSON",
              label: "Standard",
              labelAr: "عادي",
              durationMins: 60,
              price: 20000,
              isInherited: true,
            },
          ],
        },
      ],
      ["in_person"],
    )

    render(
      <EmployeeCustomPricingRow
        item={item}
        serviceId="svc-1"
        employeeId="emp-1"
        t={t}
        isSaving={false}
        onSave={onSave}
      />,
    )

    expect(
      screen.getByText("services.employees.durations.inherited"),
    ).toBeInTheDocument()
  })

  it("add row button appends an empty editable row", () => {
    const item = makeEmployee(
      [
        {
          deliveryType: "IN_PERSON",
          durations: [
            {
              id: "dur-1",
              deliveryType: "IN_PERSON",
              label: "Standard",
              labelAr: "عادي",
              durationMins: 60,
              price: 20000,
              isInherited: false,
            },
          ],
        },
      ],
      ["in_person"],
    )

    render(
      <EmployeeCustomPricingRow
        item={item}
        serviceId="svc-1"
        employeeId="emp-1"
        t={t}
        isSaving={false}
        onSave={onSave}
      />,
    )

    // Initially 1 row
    const addBtn = screen.getByText(/services.employees.durations.addRow/)
    expect(screen.getAllByLabelText("services.employees.durations.durationCol")).toHaveLength(1)
    fireEvent.click(addBtn)
    expect(screen.getAllByLabelText("services.employees.durations.durationCol")).toHaveLength(2)
  })

  it("delete row removes it from the list", () => {
    const item = makeEmployee(
      [
        {
          deliveryType: "IN_PERSON",
          durations: [
            {
              id: "dur-1",
              deliveryType: "IN_PERSON",
              label: "Standard",
              labelAr: "عادي",
              durationMins: 60,
              price: 20000,
              isInherited: false,
            },
            {
              id: "dur-2",
              deliveryType: "IN_PERSON",
              label: "Extended",
              labelAr: "ممتدة",
              durationMins: 90,
              price: 30000,
              isInherited: false,
            },
          ],
        },
      ],
      ["in_person"],
    )

    render(
      <EmployeeCustomPricingRow
        item={item}
        serviceId="svc-1"
        employeeId="emp-1"
        t={t}
        isSaving={false}
        onSave={onSave}
      />,
    )

    expect(screen.getAllByLabelText("services.employees.durations.durationCol")).toHaveLength(2)
    const deleteBtns = screen.getAllByLabelText("services.employees.durations.remove")
    fireEvent.click(deleteBtns[0])
    expect(screen.getAllByLabelText("services.employees.durations.durationCol")).toHaveLength(1)
  })

  it("save payload contains correct structure for IN_PERSON durations", () => {
    const item = makeEmployee(
      [
        {
          deliveryType: "IN_PERSON",
          durations: [
            {
              id: "dur-1",
              deliveryType: "IN_PERSON",
              label: "Standard",
              labelAr: "عادي",
              durationMins: 60,
              price: 20000,
              isInherited: false,
            },
            {
              id: "dur-2",
              deliveryType: "IN_PERSON",
              label: "Extended",
              labelAr: "ممتدة",
              durationMins: 90,
              price: 30000,
              isInherited: false,
            },
          ],
        },
      ],
      ["in_person"],
    )

    render(
      <EmployeeCustomPricingRow
        item={item}
        serviceId="svc-1"
        employeeId="emp-1"
        t={t}
        isSaving={false}
        onSave={onSave}
      />,
    )

    // Mark dirty by clicking add then remove
    const addBtn = screen.getByText(/services.employees.durations.addRow/)
    fireEvent.click(addBtn)
    // Now remove the newly added row (it's the 3rd)
    const deleteBtns = screen.getAllByLabelText("services.employees.durations.remove")
    fireEvent.click(deleteBtns[2])

    // Save
    const saveBtn = screen.getByText("services.employees.durations.save")
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledOnce()
    const payload = onSave.mock.calls[0][0] as SetPractitionerDurationsPayload
    expect(payload.durations).toHaveLength(1)
    expect(payload.durations[0].deliveryType).toBe("IN_PERSON")
    expect(payload.durations[0].items).toHaveLength(2)
  })

  it("label columns are not rendered", () => {
    const item = makeEmployee(
      [{ deliveryType: "IN_PERSON", durations: [{ id: "dur-1", deliveryType: "IN_PERSON", label: "Standard", labelAr: "عادي", durationMins: 60, price: 20000, isInherited: false }] }],
      ["in_person"],
    )
    render(<EmployeeCustomPricingRow item={item} serviceId="svc-1" employeeId="emp-1" t={t} isSaving={false} onSave={onSave} />)
    expect(screen.queryByText(/التسمية/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Label EN/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/labelCol/i)).not.toBeInTheDocument()
  })

  it("renders a section for each supported delivery type even with no rows", () => {
    const item = makeEmployee(
      [{ deliveryType: "IN_PERSON", durations: [{ id: "dur-1", deliveryType: "IN_PERSON", label: "S", labelAr: "س", durationMins: 60, price: 20000, isInherited: false }] }],
      ["in_person", "online"],
    )
    render(<EmployeeCustomPricingRow item={item} serviceId="svc-1" employeeId="emp-1" t={t} isSaving={false} onSave={onSave} />)
    expect(screen.getByText("services.employees.durations.inPerson")).toBeInTheDocument()
    expect(screen.getByText("services.employees.durations.online")).toBeInTheDocument()
    expect(screen.getAllByText(/services.employees.durations.addRow/)).toHaveLength(2)
  })

  it("save auto-generates label and labelAr from durationMins", () => {
    const item = makeEmployee(
      [{ deliveryType: "IN_PERSON", durations: [{ id: "dur-1", deliveryType: "IN_PERSON", label: "Standard", labelAr: "عادي", durationMins: 60, price: 20000, isInherited: false }] }],
      ["in_person"],
    )
    render(<EmployeeCustomPricingRow item={item} serviceId="svc-1" employeeId="emp-1" t={t} isSaving={false} onSave={onSave} />)
    // Mark dirty by adding then removing a row
    const addBtn = screen.getByText(/services.employees.durations.addRow/)
    fireEvent.click(addBtn)
    const deleteBtns = screen.getAllByLabelText("services.employees.durations.remove")
    fireEvent.click(deleteBtns[deleteBtns.length - 1])
    fireEvent.click(screen.getByText("services.employees.durations.save"))
    expect(onSave).toHaveBeenCalledOnce()
    const payload = onSave.mock.calls[0][0] as SetPractitionerDurationsPayload
    expect(payload.durations[0].items[0].label).toBe("60 min")
    expect(payload.durations[0].items[0].labelAr).toBe("60 دقيقة")
    expect(payload.durations[0].items[0].price).toBe(20000)
  })

  it("saving one section preserves the other section's items", () => {
    const item = makeEmployee(
      [
        { deliveryType: "IN_PERSON", durations: [{ id: "dur-1", deliveryType: "IN_PERSON", label: "S", labelAr: "س", durationMins: 60, price: 20000, isInherited: false }] },
        { deliveryType: "ONLINE", durations: [{ id: "dur-2", deliveryType: "ONLINE", label: "O", labelAr: "أ", durationMins: 45, price: 15000, isInherited: false }] },
      ],
      ["in_person", "online"],
    )
    render(<EmployeeCustomPricingRow item={item} serviceId="svc-1" employeeId="emp-1" t={t} isSaving={false} onSave={onSave} />)
    // Add a row to IN_PERSON section (first addRow button)
    const addBtns = screen.getAllByText(/services.employees.durations.addRow/)
    fireEvent.click(addBtns[0])
    // Click the IN_PERSON save button
    const saveBtns = screen.getAllByText("services.employees.durations.save")
    fireEvent.click(saveBtns[0])
    expect(onSave).toHaveBeenCalledOnce()
    const payload = onSave.mock.calls[0][0] as SetPractitionerDurationsPayload
    expect(payload.durations).toHaveLength(2)
    const onlineEntry = payload.durations.find(d => d.deliveryType === "ONLINE")
    expect(onlineEntry).toBeDefined()
    expect(onlineEntry!.items).toHaveLength(1)
    expect(onlineEntry!.items[0].label).toBe("45 min")
  })

  it("save payload omits id when isInherited was true and row was edited", () => {
    const item = makeEmployee(
      [
        {
          deliveryType: "IN_PERSON",
          durations: [
            {
              id: "dur-1",
              deliveryType: "IN_PERSON",
              label: "Standard",
              labelAr: "عادي",
              durationMins: 60,
              price: 20000,
              isInherited: true,
            },
          ],
        },
      ],
      ["in_person"],
    )

    render(
      <EmployeeCustomPricingRow
        item={item}
        serviceId="svc-1"
        employeeId="emp-1"
        t={t}
        isSaving={false}
        onSave={onSave}
      />,
    )

    // Trigger an edit to flip isInherited → false (simulate user changing price)
    const priceInput = screen.getByLabelText("services.employees.durations.priceCol")
    fireEvent.click(priceInput)
    fireEvent.change(priceInput, { target: { value: "250" } })
    fireEvent.keyDown(priceInput, { key: "Enter" })

    // Mark dirty via add+remove so the Save button is rendered
    const addBtn = screen.getByText(/services.employees.durations.addRow/)
    fireEvent.click(addBtn)
    const deleteBtns = screen.getAllByLabelText("services.employees.durations.remove")
    fireEvent.click(deleteBtns[deleteBtns.length - 1])

    const saveBtn = screen.getByText("services.employees.durations.save")
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledOnce()
    const payload = onSave.mock.calls[0][0] as SetPractitionerDurationsPayload
    expect(payload.durations).toHaveLength(1)
    expect(payload.durations[0].items).toHaveLength(1)
    expect(payload.durations[0].items[0]).not.toHaveProperty("id")
  })
})
