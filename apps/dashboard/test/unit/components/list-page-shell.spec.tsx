import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ListPageShell } from "@/components/features/list-page-shell"

describe("ListPageShell", () => {
  it("renders children", () => {
    render(
      <ListPageShell>
        <p>محتوى الصفحة</p>
      </ListPageShell>,
    )
    expect(screen.getByText("محتوى الصفحة")).toBeInTheDocument()
  })

  it("renders multiple children", () => {
    render(
      <ListPageShell>
        <p>عنصر 1</p>
        <p>عنصر 2</p>
      </ListPageShell>,
    )
    expect(screen.getByText("عنصر 1")).toBeInTheDocument()
    expect(screen.getByText("عنصر 2")).toBeInTheDocument()
  })
})
