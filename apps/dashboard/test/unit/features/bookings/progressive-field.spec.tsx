import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import React from "react"
import { ProgressiveField } from "@/components/features/bookings/progressive-field"

describe("ProgressiveField", () => {
  it("returns null when show is false", () => {
    const { container } = render(
      <ProgressiveField show={false}>
        <span>Hidden content</span>
      </ProgressiveField>,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders children when show is true", () => {
    render(
      <ProgressiveField show={true}>
        <span data-testid="content">Visible content</span>
      </ProgressiveField>,
    )
    expect(screen.getByTestId("content")).toBeTruthy()
  })
})
