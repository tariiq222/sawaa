import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  PackageFamilyEditor,
  type PackageFamilyEditorValue,
} from "@/components/features/packages/package-family-editor"
import {
  copyFamilyOption,
  familyOptionSessionCount,
} from "@/lib/package-family-form"
import type { PackageFamilyOptionInput } from "@sawaa/shared/types"

const { uploadImage } = vi.hoisted(() => ({ uploadImage: vi.fn() }))
vi.mock("@/lib/api/package-families", () => ({ uploadPackageFamilyImage: uploadImage }))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", dir: "ltr", t: (key: string) => key }),
}))
vi.mock("@/hooks/use-services", () => ({
  useAllServices: () => ({ data: [{ id: "00000000-0000-4000-8000-000000000001", nameAr: "عيادة", nameEn: "Clinic", isHidden: false, category: null }] }),
  useServiceEmployees: () => ({ data: [{ employee: { id: "00000000-0000-4000-8000-000000000002", nameAr: "ممارس", title: "Counselor", isActive: true, user: { firstName: "Test", lastName: "Practitioner" } }, effectiveDurations: [{ deliveryType: "IN_PERSON", durations: [{ id: "00000000-0000-4000-8000-000000000003", label: "45 minutes", labelAr: "45 دقيقة", durationMins: 45, price: 10000 }] }] }] }),
}))
vi.mock("@/lib/package-editor-labels", () => ({ packageEmployeeLabel: () => "Test Practitioner" }))
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })

const group = (key: string, count: number, unitPrice = 10000) => ({
  key,
  label: key,
  serviceId: "00000000-0000-4000-8000-000000000001",
  employeeId: "00000000-0000-4000-8000-000000000002",
  sequenceMode: "ORDERED" as const,
  dependsOnGroupKey: null,
  sessions: Array.from({ length: count }, (_, position) => ({
    key: `${key}-session-${position}`,
    position,
    durationOptionId: "00000000-0000-4000-8000-000000000003",
    deliveryType: "IN_PERSON" as const,
    unitPrice,
  })),
})

const option = (
  nameAr: string,
  groups: ReturnType<typeof group>[],
  globalDiscount: PackageFamilyOptionInput["globalDiscount"] = {
    type: "NONE",
    value: 0,
  },
): PackageFamilyOptionInput => ({
  nameAr,
  nameEn: null,
  isActive: true,
  isPublic: true,
  groups,
  globalDiscount,
})

const family = (options: PackageFamilyOptionInput[]): PackageFamilyEditorValue => ({
  nameAr: "جلسات أسرية",
  nameEn: "Family sessions",
  descriptionAr: "",
  descriptionEn: "",
  imageUrl: null,
  isActive: true,
  isPublic: true,
  sortOrder: 0,
  options,
})

describe("PackageFamilyEditor", () => {
  it("merges a delayed image upload into the latest family draft and propagates it", async () => {
    let resolveUpload!: (key: string) => void
    uploadImage.mockReturnValueOnce(new Promise<string>(resolve => { resolveUpload = resolve }))
    URL.createObjectURL = vi.fn(() => "blob:family-preview")
    URL.revokeObjectURL = vi.fn()
    const change = vi.fn()
    const save = vi.fn()
    render(<PackageFamilyEditor initialValue={family([option("خمس جلسات", [group("clinic", 5)])])} onChange={change} onSubmit={save} onCancel={vi.fn()} />)

    const file = new File(["image"], "family.png", { type: "image/png" })
    fireEvent.change(screen.getByLabelText("catalog.familyImage"), { target: { files: [file] } })
    expect(uploadImage).toHaveBeenCalledWith(file)
    expect(screen.getByRole("button", { name: "packages.family.save" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("packages.create.nameAr"), { target: { value: "جلسات محدثة" } })
    fireEvent.click(screen.getByRole("button", { name: "packages.family.options.copy" }))
    expect(change.mock.lastCall?.[0].options).toHaveLength(2)

    resolveUpload("objects/family.png")
    await waitFor(() => expect(change.mock.lastCall?.[0].imageUrl).toBe("objects/family.png"))
    expect(screen.getByLabelText("packages.create.nameAr")).toHaveValue("جلسات محدثة")
    expect(change.mock.lastCall?.[0].nameAr).toBe("جلسات محدثة")
    expect(change.mock.lastCall?.[0].options).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "packages.family.save" }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ nameAr: "جلسات محدثة", imageUrl: "objects/family.png", options: expect.any(Array) })))
    expect(save.mock.lastCall?.[0].options).toHaveLength(2)
  })

  it("derives total sessions from all groups and displays separate 5 and 9 option counts", () => {
    const value = family([
      option("خمس جلسات", [group("assessment", 1), group("clinic", 4)]),
      option("تسع جلسات", [group("assessment", 1), group("clinic", 8)]),
    ])

    expect(familyOptionSessionCount(value.options[0])).toBe(5)
    expect(familyOptionSessionCount(value.options[1])).toBe(9)
    render(<PackageFamilyEditor initialValue={value} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByTestId("family-option-count-0")).toHaveTextContent("5")
    expect(screen.getByTestId("family-option-count-1")).toHaveTextContent("9")
  })

  it("namespaced group controls keep labels attached across family options", () => {
    const value = family([
      option("خمس جلسات", [group("clinic", 5)]),
      option("تسع جلسات", [group("clinic", 9)]),
    ])
    render(<PackageFamilyEditor initialValue={value} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    const services = screen.getAllByRole("combobox", { name: "packages.grouped.groups.service" })
    expect(services.map((control) => control.id)).toEqual([
      "family-option-0-groups.0.serviceId",
      "family-option-1-groups.0.serviceId",
    ])
    expect(document.querySelectorAll("#family-option-0-groups\\.0\\.serviceId")).toHaveLength(1)
    expect(document.querySelectorAll("#family-option-1-groups\\.0\\.serviceId")).toHaveLength(1)
  })

  it("adds, copies with fresh local keys and removes an option without changing the other option state", () => {
    const first = option("خمس جلسات", [group("clinic", 5)], {
      type: "PERCENTAGE",
      value: 10,
    })
    const second = option("تسع جلسات", [group("clinic", 9)])
    const onChange = vi.fn()
    const value = family([first, second])
    render(<PackageFamilyEditor initialValue={value} onChange={onChange} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "packages.family.options.add" }))
    expect(onChange.mock.lastCall?.[0].options).toHaveLength(3)
    expect(onChange.mock.lastCall?.[0].options[0].globalDiscount).toEqual(first.globalDiscount)

    fireEvent.click(screen.getAllByRole("button", { name: "packages.family.options.copy" })[0])
    const copied = onChange.mock.lastCall?.[0].options.at(-1)
    expect(copied.id).toBeUndefined()
    expect(copied.globalDiscount).toEqual(first.globalDiscount)
    expect(copied.groups[0].key).not.toBe(first.groups[0].key)
    expect(copied.groups[0].sessions[0].key).not.toBe(first.groups[0].sessions[0].key)

    fireEvent.click(screen.getAllByRole("button", { name: "packages.family.options.remove" })[0])
    expect(onChange.mock.lastCall?.[0].options).toHaveLength(3)
    expect(onChange.mock.lastCall?.[0].options[0].nameAr).toBe(second.nameAr)
    expect(onChange.mock.lastCall?.[0].options[0].groups).toEqual(second.groups)
  })

  it("keeps group and discount state independent between options", () => {
    const value = family([
      option("خمس جلسات", [group("clinic", 5, 10000)], { type: "PERCENTAGE", value: 10 }),
      option("تسع جلسات", [group("clinic", 9, 20000)], { type: "FIXED", value: 5000 }),
    ])
    const onChange = vi.fn()
    render(<PackageFamilyEditor initialValue={value} onChange={onChange} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByDisplayValue("10")).toBeInTheDocument()
    expect(screen.getByDisplayValue("50")).toBeInTheDocument()
    expect(screen.getAllByDisplayValue("100").length).toBeGreaterThan(0)
    expect(screen.getAllByDisplayValue("200").length).toBeGreaterThan(0)
  })

  it("updates active and public visibility independently for each option", () => {
    const onChange = vi.fn()
    render(<PackageFamilyEditor initialValue={family([
      option("خمس جلسات", [group("clinic", 5)]),
      option("تسع جلسات", [group("clinic", 9)]),
    ])} onChange={onChange} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole("switch", { name: "packages.family.options.isActive خمس جلسات 1" }))
    fireEvent.click(screen.getByRole("switch", { name: "packages.family.options.isPublic تسع جلسات 2" }))

    expect(onChange.mock.lastCall?.[0].options[0].isActive).toBe(false)
    expect(onChange.mock.lastCall?.[0].options[1].isPublic).toBe(false)
  })

  it("prevents duplicate saves while the first save is pending", async () => {
    let resolveSave!: () => void
    const save = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve }))
    const value = family([option("خمس جلسات", [group("clinic", 5)])])
    const changes = vi.fn()
    render(<PackageFamilyEditor initialValue={value} onChange={changes} onSubmit={save} onCancel={vi.fn()} />)

    const button = screen.getByRole("button", { name: "packages.family.save" })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(save).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    resolveSave()
    await waitFor(() => expect(button).not.toBeDisabled())
  })

  it("blocks submit when the family has no options", () => {
    const onSubmit = vi.fn()
    render(<PackageFamilyEditor initialValue={family([])} onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "packages.family.save" }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText("packages.family.errors.optionRequired")).toBeInTheDocument()
  })

  it("blocks submit when the shared family name is empty", () => {
    const onSubmit = vi.fn()
    render(<PackageFamilyEditor initialValue={{ ...family([option("خمس جلسات", [group("clinic", 5)])]), nameAr: "" }} onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "packages.family.save" }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText("packages.family.errors.nameRequired")).toBeInTheDocument()
  })

  it("clears persisted identity when copying an existing option", () => {
    const existing = { ...option("خمس جلسات", [group("clinic", 5)]), id: "offer-5" }
    const copied = copyFamilyOption(existing)

    expect(copied.id).toBeUndefined()
    expect(copied.nameAr).toBe(existing.nameAr)
    expect(copied.groups[0].key).not.toBe(existing.groups[0].key)
  })
})
