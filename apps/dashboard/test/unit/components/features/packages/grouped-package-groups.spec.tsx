import { FormProvider, useForm } from "react-hook-form"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GroupedPackageGroups } from "@/components/features/packages/grouped-package-groups"
import { groupedFormDefaults } from "@/lib/package-groups-form"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ locale: "en", dir: "ltr", t: (key: string) => key }) }))
vi.mock("@/hooks/use-services", () => ({
  useAllServices: () => ({ data: [{ id: "service-a", nameAr: "عيادة", nameEn: "Clinic", isHidden: false, category: null }] }),
  useServiceEmployees: () => ({ data: [{ employee: { id: "employee-a", nameAr: "ممارس", title: "Counselor", isActive: true, user: { firstName: "Test", lastName: "Practitioner" } }, effectiveDurations: [{ deliveryType: "IN_PERSON", durations: [{ id: "duration-a", deliveryType: "IN_PERSON", label: "45 minutes", labelAr: "45 دقيقة", durationMins: 45, price: 15000 }, { id: "duration-b", deliveryType: "IN_PERSON", label: "60 minutes", labelAr: "60 دقيقة", durationMins: 60, price: 20000 }] }] }] }),
}))
vi.mock("@/lib/package-editor-labels", () => ({ packageEmployeeLabel: () => "Test Practitioner" }))

function Harness({ values }: { values: GroupedPackageFormData }) {
  const form = useForm<GroupedPackageFormData>({ defaultValues: values })
  return <FormProvider {...form}><GroupedPackageGroups form={form} translateError={(message) => message} /></FormProvider>
}

function valuesWithTwoSessions(): GroupedPackageFormData {
  const values = groupedFormDefaults()
  values.groups[0] = { ...values.groups[0], label: "First stage", serviceId: "service-a", employeeId: "employee-a", sessionMode: "DETAIL", sessions: [
    { ...values.groups[0].sessions[0], durationOptionId: "duration-a", unitPriceSar: 150, key: "session-a" },
    { ...values.groups[0].sessions[0], durationOptionId: "duration-b", unitPriceSar: 200, key: "session-b", position: 1 },
  ] }
  return values
}

describe("GroupedPackageGroups", () => {
  it("keeps distinct detail values until the explicit SAME apply action", () => {
    render(<Harness values={valuesWithTwoSessions()} />)
    expect(document.getElementById("groups.0.serviceId")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "packages.grouped.sessionMode.SAME" }))
    expect(screen.getByRole("button", { name: "packages.grouped.sessionMode.applyFirst" })).toBeInTheDocument()
    expect(screen.getAllByLabelText("packages.grouped.duration")[1]).toHaveValue("duration-b")
    fireEvent.click(screen.getByRole("button", { name: "packages.grouped.sessionMode.applyFirst" }))
    expect(screen.getAllByLabelText("packages.grouped.duration")[0]).toHaveValue("duration-a")
    expect(screen.getAllByLabelText("packages.grouped.duration")[1]).toHaveValue("duration-a")
  })

  it("shows human dependency labels and confirms removal of referenced groups", () => {
    const values = valuesWithTwoSessions()
    values.groups.push({ ...values.groups[0], key: "group-b", label: "Second stage", serviceId: "service-a", sessions: [{ ...values.groups[0].sessions[0], key: "session-c" }] })
    values.groups[1].dependsOnGroupKey = values.groups[0].key
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<Harness values={values} />)
    expect(screen.getByRole("option", { name: /First stage/ })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "packages.grouped.groups.remove" })[0])
    expect(confirm).toHaveBeenCalled()
    expect(screen.getAllByRole("button", { name: "packages.grouped.groups.remove" })).toHaveLength(2)
    confirm.mockRestore()
  })
})
