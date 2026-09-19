import { createEvent, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (key: string) => key,
    toggleLocale: vi.fn(),
  }),
}))

import { PackageEditorNavigation } from "@/components/features/packages/package-editor-navigation"

function NavigationHarness({ onSubmit }: { onSubmit: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(3)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <PackageEditorNavigation
        step={step}
        isPending={false}
        submitLabel="save-now"
        onBack={vi.fn()}
        onNext={() => setStep(4)}
        onCancel={vi.fn()}
      />
    </form>
  )
}

describe("PackageEditorNavigation", () => {
  it("moves to review without submitting until the final button is clicked", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<NavigationHarness onSubmit={onSubmit} />)

    await user.click(
      screen.getByRole("button", { name: "packages.steps.next" })
    )

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "save-now" })).toHaveAttribute(
      "type",
      "submit"
    )

    await user.click(screen.getByRole("button", { name: "save-now" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("prevents focus blur from moving the Next click target", () => {
    render(<NavigationHarness onSubmit={vi.fn()} />)

    const next = screen.getByRole("button", { name: "packages.steps.next" })
    const mouseDown = createEvent.mouseDown(next)
    fireEvent(next, mouseDown)

    expect(mouseDown.defaultPrevented).toBe(true)
  })
})
