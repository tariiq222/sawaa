import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServiceAvatar } from "@/components/features/shared/service-avatar"

describe("ServiceAvatar image fallback", () => {
  it("renders the image while it loads", () => {
    render(<ServiceAvatar imageUrl="/uploads/service.png" name="استشارة" />)

    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("src", "/uploads/service.png")
    expect(img).toHaveClass("h-8", "w-8")
  })

  it("shows the initials placeholder at the same size when the image fails", () => {
    const { container } = render(
      <ServiceAvatar imageUrl="/uploads/broken.png" name="استشارة" size="md" />,
    )

    fireEvent.error(screen.getByRole("img"))

    expect(screen.queryByRole("img")).toBeNull()
    // Same outer box as the <img> it replaces — no layout jump.
    expect(container.querySelector(".h-12.w-12")).not.toBeNull()
  })

  it("prefers the configured icon fallback when the image fails", () => {
    const { container } = render(
      <ServiceAvatar
        imageUrl="/uploads/broken.png"
        iconName="HeartCheckIcon"
        iconBgColor="#123456"
        name="استشارة"
      />,
    )

    fireEvent.error(screen.getByRole("img"))

    expect(screen.queryByRole("img")).toBeNull()
    const fallback = container.querySelector(".h-8.w-8")
    expect(fallback).not.toBeNull()
    expect(fallback).toHaveStyle({ backgroundColor: "#123456" })
  })

  it("retries and shows the new image after a failed load", () => {
    const { rerender } = render(
      <ServiceAvatar imageUrl="/uploads/old.png" name="استشارة" />,
    )

    fireEvent.error(screen.getByRole("img"))
    expect(screen.queryByRole("img")).toBeNull()

    rerender(<ServiceAvatar imageUrl="/uploads/new.png" name="استشارة" />)

    expect(screen.getByRole("img")).toHaveAttribute("src", "/uploads/new.png")
  })

  it("keeps the fallback while the same failing src is unchanged", () => {
    const { rerender } = render(
      <ServiceAvatar imageUrl="/uploads/broken.png" name="استشارة" />,
    )

    fireEvent.error(screen.getByRole("img"))
    rerender(<ServiceAvatar imageUrl="/uploads/broken.png" name="استشارة" />)

    expect(screen.queryByRole("img")).toBeNull()
  })
})
