import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

const { categoriesState, departmentsState } = vi.hoisted(() => ({
  categoriesState: { data: undefined as unknown, isLoading: false, isError: false },
  departmentsState: { options: [] as Array<{ id: string; nameAr: string; nameEn: string }> },
}))

vi.mock("@/hooks/use-services", () => ({
  useCategories: () => categoriesState,
}))
vi.mock("@/hooks/use-service-form-categories", () => ({
  useServiceFormCategories: () => categoriesState,
}))
vi.mock("@/hooks/use-departments", () => ({
  useDepartmentOptions: () => departmentsState,
}))
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "en" }),
}))
vi.mock("@/components/features/shared/service-avatar-picker", () => ({ ServiceAvatarPicker: () => null }))
vi.mock("@/components/features/services/service-branches-tab", () => ({ ServiceBranchesTab: () => null }))
vi.mock("@/components/features/services/service-branches-picker", () => ({ ServiceBranchesPicker: () => null }))

import { BasicInfoTab } from "@/components/features/services/create/basic-info-tab"
import { createServiceDefaults, createServiceEditSchema, createServiceSchema, type CreateServiceFormData } from "@/components/features/services/create/form-schema"
import { buildPayload, buildServiceEditPayload } from "@/components/features/services/service-form-helpers"
import { canSubmitCreateCategoryContext, categoryServicesReturnPath, getInitialCategoryContextValue, resolveCreateCategoryContext } from "@/components/features/services/service-form-context"
import type { ServiceCategory } from "@/lib/types/service"

Object.assign(HTMLElement.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
})

const categoryServices: ServiceCategory[] = [
  { id: "service-category", ref: 41, nameAr: "العلاج", nameEn: "Therapy", departmentId: "dept-1", bookingMode: "SERVICES", sortOrder: 0, isActive: true, iconName: null, iconBgColor: null, imageUrl: null, createdAt: "2026-01-01" },
  { id: "direct-category", ref: 42, nameAr: "عيادة", nameEn: "Clinic", departmentId: "dept-1", bookingMode: "DIRECT", sortOrder: 0, isActive: true, iconName: null, iconBgColor: null, imageUrl: null, createdAt: "2026-01-01" },
  { id: "legacy-category", ref: 43, nameAr: "قديم", nameEn: "Legacy", departmentId: null, sortOrder: 0, isActive: true, iconName: null, iconBgColor: null, imageUrl: null, createdAt: "2026-01-01" },
]

function BasicInfoHarness({ onCategoryChange, edit = false, internal = false, categoryId = "" }: { onCategoryChange?: (id: string) => void; edit?: boolean; internal?: boolean; categoryId?: string }) {
  const form = useForm<CreateServiceFormData>({ defaultValues: { ...createServiceDefaults, categoryId } })
  return (
    <>
      <BasicInfoTab form={form} isEdit={edit} isInternalService={internal} savedCategoryId={categoryId} savedCategoryName="Clinic" internalCategoryName="Clinic" />
      <output aria-label="selected category">{form.watch("categoryId")}</output>
      <button type="button" onClick={() => onCategoryChange?.(form.getValues("categoryId"))}>Read selection</button>
    </>
  )
}

describe("service create category context", () => {
  it("keeps an unresolved originating category in a loading state until categories finish loading", () => {
    expect(resolveCreateCategoryContext("category-1", [], { isLoading: true, isError: false }).status).toBe("loading")
  })

  it("blocks missing, unknown, and DIRECT contexts while accepting legacy SERVICES categories", () => {
    expect(resolveCreateCategoryContext("", categoryServices, { isLoading: false, isError: false }).status).toBe("missing")
    expect(resolveCreateCategoryContext("unknown", categoryServices, { isLoading: false, isError: false }).status).toBe("invalid")
    expect(resolveCreateCategoryContext("direct-category", categoryServices, { isLoading: false, isError: false }).status).toBe("direct")
    expect(resolveCreateCategoryContext("legacy-category", categoryServices, { isLoading: false, isError: false }).status).toBe("valid")
  })

  it("returns a valid category create flow to its original services tab", () => {
    expect(categoryServicesReturnPath({ ref: 41 })).toBe("/categories/CAT-41/edit?tab=services")
  })

  it("prefills an untouched form once and leaves a user's category choice intact", () => {
    expect(getInitialCategoryContextValue("origin-category", "", false)).toBe("origin-category")
    expect(getInitialCategoryContextValue("origin-category", "user-category", true)).toBeUndefined()
  })

  it("blocks submission for an explicit missing or DIRECT context while allowing ordinary create", () => {
    expect(canSubmitCreateCategoryContext(false, undefined)).toBe(true)
    expect(canSubmitCreateCategoryContext(true, "missing")).toBe(false)
    expect(canSubmitCreateCategoryContext(true, "invalid")).toBe(false)
    expect(canSubmitCreateCategoryContext(true, "direct")).toBe(false)
    expect(canSubmitCreateCategoryContext(true, "valid")).toBe(true)
  })

  it("validates missing categories only for create while allowing a saved empty category on edit", () => {
    const serviceFields = { nameEn: "Consultation", nameAr: "استشارة", categoryId: "" }
    expect(createServiceSchema.safeParse(serviceFields).success).toBe(false)
    expect(createServiceEditSchema("Consultation").safeParse(serviceFields).success).toBe(true)
    expect(createServiceEditSchema("Consultation").safeParse({ ...serviceFields, categoryId: "bad-id" }).success).toBe(false)
  })

  it("does not allow an existing nonempty English service name to be cleared", () => {
    const savedServiceFields = { nameEn: "", nameAr: "استشارة", categoryId: "" }
    expect(createServiceEditSchema("Existing name").safeParse(savedServiceFields).success).toBe(false)
    expect(createServiceEditSchema("Existing name").safeParse({ ...savedServiceFields, nameEn: "Replacement" }).success).toBe(true)
    expect(createServiceEditSchema("").safeParse(savedServiceFields).success).toBe(true)
    expect(createServiceEditSchema(null).safeParse(savedServiceFields).success).toBe(true)
  })

  it("allows a legacy null English name in edit and omits internal identity fields from its update payload", () => {
    const internalServiceDraft = {
      ...createServiceDefaults,
      nameEn: "",
      nameAr: "خدمة داخلية",
      categoryId: "00000000-0000-4000-a000-000000000001",
      isHidden: true,
      minLeadMinutes: 45,
    }
    expect(createServiceEditSchema(null).safeParse(internalServiceDraft).success).toBe(true)
    expect(createServiceSchema.safeParse(internalServiceDraft).success).toBe(false)
    expect(buildServiceEditPayload(internalServiceDraft, true)).not.toHaveProperty("nameEn")
    expect(buildServiceEditPayload(internalServiceDraft, true)).not.toHaveProperty("nameAr")
    expect(buildServiceEditPayload(internalServiceDraft, true)).not.toHaveProperty("categoryId")
    expect(buildServiceEditPayload(internalServiceDraft, true)).not.toHaveProperty("isHidden")
    expect(buildServiceEditPayload(internalServiceDraft, true)).toHaveProperty("minLeadMinutes", 45)
    expect(buildPayload(internalServiceDraft)).toHaveProperty("categoryId", internalServiceDraft.categoryId)
  })

  it("omits unchanged null English name and missing category on ordinary edit, but keeps a valid name update", () => {
    const uncategorizedLegacyDraft = {
      ...createServiceDefaults,
      nameEn: "",
      nameAr: "استشارة",
      categoryId: "",
      minLeadMinutes: 60,
    }
    const unchangedPayload = buildServiceEditPayload(uncategorizedLegacyDraft, false, null)
    expect(unchangedPayload).not.toHaveProperty("nameEn")
    expect(unchangedPayload).not.toHaveProperty("categoryId")
    expect(unchangedPayload).toHaveProperty("minLeadMinutes", 60)
    expect(buildServiceEditPayload(uncategorizedLegacyDraft, false, "")).not.toHaveProperty("nameEn")

    const updatedPayload = buildServiceEditPayload({ ...uncategorizedLegacyDraft, nameEn: "Consultation" }, false, null)
    expect(updatedPayload).toHaveProperty("nameEn", "Consultation")
  })

  it("keeps a hidden DIRECT clinic service identity and category read-only on edit", () => {
    categoriesState.data = categoryServices
    categoriesState.isLoading = false
    categoriesState.isError = false
    render(<BasicInfoHarness edit internal categoryId="direct-category" />)

    expect(screen.getByDisplayValue("Clinic")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "services.manageClinic" })).toHaveAttribute("href", "/categories")
    expect(screen.getByRole("switch", { name: "services.create.isHidden" })).toBeDisabled()
    expect(document.querySelector('input[name="nameEn"]')).toHaveAttribute("readonly")
    expect(document.querySelector('input[name="nameAr"]')).toHaveAttribute("readonly")
    expect(screen.getByLabelText("selected category")).toHaveTextContent("direct-category")
  })

  it("offers only SERVICES categories and derives the department from the selected category", async () => {
    categoriesState.data = categoryServices
    categoriesState.isLoading = false
    categoriesState.isError = false
    departmentsState.options = [{ id: "dept-1", nameAr: "قسم العلاج", nameEn: "Counseling" }]
    const user = userEvent.setup()
    render(<BasicInfoHarness />)

    const categorySelect = screen.getAllByRole("combobox").at(-1)!
    await user.click(categorySelect)
    expect(screen.getByRole("option", { name: "Therapy" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Legacy" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Clinic" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("option", { name: "Therapy" }))
    expect(await screen.findByDisplayValue("Counseling")).toBeInTheDocument()
    expect(screen.getByLabelText("selected category")).toHaveTextContent("service-category")
  })

  it("accepts legacy categories with no booking mode as SERVICES during create", async () => {
    categoriesState.data = [categoryServices[2]]
    categoriesState.isLoading = false
    categoriesState.isError = false
    render(<BasicInfoHarness />)

    const categorySelect = screen.getAllByRole("combobox").at(-1)!
    await userEvent.setup().click(categorySelect)
    expect(screen.getByRole("option", { name: "Legacy" })).toBeInTheDocument()
  })
})
