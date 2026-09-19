import { FormProvider, useForm } from "react-hook-form"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GroupedPackageReview } from "@/components/features/packages/grouped-package-review"
import { groupedFormDefaults } from "@/lib/package-groups-form"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ locale: "en", dir: "ltr", t: (key: string) => key }) }))
vi.mock("@/hooks/use-services", () => ({
  useAllServices: () => ({ data: [{ id: "service-a", nameAr: "عيادة", nameEn: "Clinic", isHidden: false, category: null }] }),
  useServiceEmployees: () => ({ data: [{ employee: { id: "employee-a", nameAr: "ممارس", title: "Counselor", isActive: true, user: { firstName: "Test", lastName: "Practitioner" } }, effectiveDurations: [{ deliveryType: "IN_PERSON", durations: [{ id: "duration-a", deliveryType: "IN_PERSON", label: "45 minutes", labelAr: "45 دقيقة", durationMins: 45, price: 15000 }] }] }] }),
}))
vi.mock("@/lib/package-editor-labels", () => ({ packageEmployeeLabel: () => "Test Practitioner" }))

function Harness({ values }: { values: GroupedPackageFormData }) {
  const form = useForm<GroupedPackageFormData>({ defaultValues: values })
  return <FormProvider {...form}><GroupedPackageReview form={form} preview={{ subtotal: 30000, discountAmount: 3000, amountPaid: 27000, prices: [15000, 15000], sessionNet: [13500, 13500], valid: true }} /></FormProvider>
}

describe("GroupedPackageReview", () => {
  it("renders service, practitioner, resolved duration and post-discount session net", () => {
    const values = groupedFormDefaults()
    values.nameAr = "Package"
    values.groups[0] = { ...values.groups[0], label: "First stage", serviceId: "service-a", employeeId: "employee-a", sessions: [{ ...values.groups[0].sessions[0], durationOptionId: "duration-a", unitPriceSar: 150 }] }
    render(<Harness values={values} />)
    expect(screen.getByText(/Clinic/)).toBeInTheDocument()
    expect(screen.getByText(/Test Practitioner/)).toBeInTheDocument()
    expect(screen.getByText(/45 minutes/)).toBeInTheDocument()
    expect(screen.getByText(/135/)).toBeInTheDocument()
  })
})
