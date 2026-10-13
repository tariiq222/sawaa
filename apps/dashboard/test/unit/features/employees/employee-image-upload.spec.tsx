import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EmployeeImageUpload } from "@/components/features/employees/employee-image-upload"
import { arEmployees } from "@/lib/translations/ar.employees"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => arEmployees[key as keyof typeof arEmployees] ?? key }),
}))

describe("employee portrait selection", () => {
  beforeEach(() => vi.stubGlobal("URL", { createObjectURL: () => "blob:accepted-photo" }))
  afterEach(() => vi.unstubAllGlobals())

  function select(file: File) {
    const { container } = render(<EmployeeImageUpload value="https://example.test/saved.png" onChange={() => {}} onClear={() => {}} />)
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } })
  }

  it("accepts an image at the 5 MB limit", () => {
    select(new File([new Uint8Array(5242880)], "photo.png", { type: "image/png" }))
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByAltText("avatar").getAttribute("src")).toBe("blob:accepted-photo")
    expect(screen.getByText("JPG أو PNG أو WebP، حتى 5 ميجابايت.")).toBeDefined()
  })

  it("explains how to fix an oversized image and preserves the current photo", () => {
    select(new File([new Uint8Array(5242881)], "photo.png", { type: "image/png" }))
    expect(screen.getByRole("alert").textContent).toContain("اختر صورة أصغر")
    expect(screen.getByAltText("avatar").getAttribute("src")).toBe("https://example.test/saved.png")
  })

  it("explains supported formats for a GIF selection", () => {
    select(new File(["gif"], "photo.gif", { type: "image/gif" }))
    expect(screen.getByRole("alert").textContent).toContain("JPG أو PNG أو WebP")
    expect(screen.getByAltText("avatar").getAttribute("src")).toBe("https://example.test/saved.png")
  })
})
