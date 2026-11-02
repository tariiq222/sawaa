import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  EmployeeAvatar,
  normalizeEmployeeAvatarSrc,
} from "@/components/features/bookings/wizard-steps/step-employee"

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    onError,
  }: {
    alt: string
    src: string
    onError?: () => void
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} data-testid="employee-avatar-image" src={src} onError={onError} />
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

  it("drops root-relative paths that are invalid URLs", () => {
    expect(normalizeEmployeeAvatarSrc("//")).toBeNull()
    expect(normalizeEmployeeAvatarSrc("///")).toBeNull()
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

  it("shows the fallback when the image fails to load", () => {
    render(<EmployeeAvatar avatarUrl="/uploads/broken.jpg" name="أحمد" />)

    fireEvent.error(screen.getByTestId("employee-avatar-image"))

    expect(screen.queryByTestId("employee-avatar-image")).toBeNull()
    expect(screen.queryByAltText("أحمد")).toBeNull()
  })

  it("retries and shows the new image after a failed load", () => {
    const { rerender } = render(
      <EmployeeAvatar avatarUrl="/uploads/old.jpg" name="أحمد" />,
    )

    fireEvent.error(screen.getByTestId("employee-avatar-image"))
    expect(screen.queryByTestId("employee-avatar-image")).toBeNull()

    rerender(<EmployeeAvatar avatarUrl="/uploads/new.jpg" name="أحمد" />)

    expect(screen.getByTestId("employee-avatar-image")).toHaveAttribute(
      "src",
      "/uploads/new.jpg",
    )
  })

  it("keeps the fallback while the same failing src is unchanged", () => {
    const { rerender } = render(
      <EmployeeAvatar avatarUrl="/uploads/broken.jpg" name="أحمد" />,
    )

    fireEvent.error(screen.getByTestId("employee-avatar-image"))
    rerender(<EmployeeAvatar avatarUrl="/uploads/broken.jpg" name="أحمد" />)

    expect(screen.queryByTestId("employee-avatar-image")).toBeNull()
  })

  it("shows the fallback for a remote image that fails to load", () => {
    render(<EmployeeAvatar avatarUrl="https://cdn.test/broken.jpg" name="أحمد" />)

    fireEvent.error(screen.getByAltText("أحمد"))

    expect(screen.queryByAltText("أحمد")).toBeNull()
    expect(screen.queryByTestId("employee-avatar-image")).toBeNull()
  })

  it("recovers a remote image after its src changes", () => {
    const { rerender } = render(
      <EmployeeAvatar avatarUrl="https://cdn.test/old.jpg" name="أحمد" />,
    )

    fireEvent.error(screen.getByAltText("أحمد"))
    expect(screen.queryByAltText("أحمد")).toBeNull()

    rerender(<EmployeeAvatar avatarUrl="https://cdn.test/new.jpg" name="أحمد" />)

    expect(screen.getByAltText("أحمد")).toHaveAttribute(
      "src",
      "https://cdn.test/new.jpg",
    )
  })
})
