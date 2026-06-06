import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  EmployeeAvatar,
  normalizeEmployeeAvatarSrc,
} from "@/components/features/bookings/wizard-steps/step-employee"

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} data-testid="employee-avatar-image" src={src} />
  ),
}))

describe("normalizeEmployeeAvatarSrc", () => {
  it("keeps absolute and root-relative image URLs", () => {
    expect(normalizeEmployeeAvatarSrc("https://cdn.test/avatar.jpg")).toBe(
      "https://cdn.test/avatar.jpg",
    )
    expect(normalizeEmployeeAvatarSrc("/uploads/avatar.jpg")).toBe(
      "/uploads/avatar.jpg",
    )
  })

  it("drops raw WordPress filenames that next/image cannot parse", () => {
    expect(
      normalizeEmployeeAvatarSrc("df0f5b76b91c0b5d6382dcd635ac7b5b.jpg"),
    ).toBeNull()
  })

  it("drops blank avatar values", () => {
    expect(normalizeEmployeeAvatarSrc("   ")).toBeNull()
    expect(normalizeEmployeeAvatarSrc(null)).toBeNull()
  })

  it("drops non-string avatar values from the API", () => {
    expect(normalizeEmployeeAvatarSrc({})).toBeNull()
    expect(normalizeEmployeeAvatarSrc({ url: "x" })).toBeNull()
    expect(normalizeEmployeeAvatarSrc(123)).toBeNull()
  })
})

describe("EmployeeAvatar", () => {
  it("renders the fallback avatar for raw WordPress filenames", () => {
    render(
      <EmployeeAvatar
        avatarUrl="df0f5b76b91c0b5d6382dcd635ac7b5b.jpg"
        name="أحمد"
      />,
    )

    expect(screen.queryByTestId("employee-avatar-image")).toBeNull()
  })

  it("renders an image for safe avatar URLs", () => {
    render(<EmployeeAvatar avatarUrl="/uploads/avatar.jpg" name="أحمد" />)

    expect(screen.getByTestId("employee-avatar-image")).toHaveAttribute(
      "src",
      "/uploads/avatar.jpg",
    )
  })
})
