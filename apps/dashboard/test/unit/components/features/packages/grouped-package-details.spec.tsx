import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useForm } from "react-hook-form"

const calls = vi.hoisted(() => ({ imageSelect: vi.fn(), imageClear: vi.fn() }))

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (key: string) => key }),
}))
// The picker is the only piece stubbed: its callbacks are the real trigger
// points for dropping the staged package avatar (t12), while
// GroupedPackageDetails itself stays real.
vi.mock("@/components/features/shared/service-avatar-picker", () => ({
  ServiceAvatarPicker: ({
    onIconChange,
    onImageChange,
    onClear,
  }: {
    iconName?: string | null
    iconBgColor?: string | null
    imageUrl?: string | null
    serviceName?: string
    onIconChange: (name: string, color: string) => void
    onImageChange: (file: File) => void
    onClear: () => void
  }) => (
    <>
      <input
        type="file"
        aria-label="avatar file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onImageChange(file)
        }}
      />
      <button type="button" onClick={() => onIconChange("Clock01Icon", "#123456")}>
        choose icon
      </button>
      <button type="button" onClick={onClear}>
        clear avatar
      </button>
    </>
  ),
}))

import { GroupedPackageDetails } from "@/components/features/packages/grouped-package-details"
import { groupedFormDefaults } from "@/lib/package-groups-form"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

function Harness() {
  const form = useForm<GroupedPackageFormData>({
    defaultValues: groupedFormDefaults(),
  })
  return (
    <>
      <GroupedPackageDetails
        form={form}
        onImageSelect={calls.imageSelect}
        onImageClear={calls.imageClear}
        translateError={(message) => message}
      />
      <output data-testid="image-url">{String(form.watch("imageUrl"))}</output>
      <output data-testid="icon-name">{String(form.watch("iconName"))}</output>
    </>
  )
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => "blob:grouped-package-avatar")
})

it("drops the staged file when the grouped package avatar is cleared", () => {
  render(<Harness />)
  const file = new File(["image"], "grouped.png", { type: "image/png" })
  fireEvent.change(screen.getByLabelText("avatar file"), {
    target: { files: [file] },
  })

  expect(calls.imageSelect).toHaveBeenCalledWith(file)
  expect(screen.getByTestId("image-url")).toHaveTextContent("blob:grouped-package-avatar")
  expect(calls.imageClear).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: "clear avatar" }))
  expect(calls.imageClear).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId("image-url")).toHaveTextContent("null")
})

it("drops the staged file when an icon replaces the grouped package avatar", () => {
  render(<Harness />)
  fireEvent.change(screen.getByLabelText("avatar file"), {
    target: { files: [new File(["image"], "grouped.png", { type: "image/png" })] },
  })
  fireEvent.click(screen.getByRole("button", { name: "choose icon" }))

  expect(calls.imageClear).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId("image-url")).toHaveTextContent("null")
  expect(screen.getByTestId("icon-name")).toHaveTextContent("Clock01Icon")
})
