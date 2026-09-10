import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FieldEditor } from "@/components/features/intake-forms/field-editor"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (key: string) => key }),
}))

const field = {
  id: "question-1", labelAr: "السؤال", labelEn: "Question",
  type: "text" as const, required: false, options: [],
}

describe("Intake field editor", () => {
  it("offers only field types that can be persisted", () => {
    render(<FieldEditor field={field} index={1} totalFields={2}
      onChange={vi.fn()} onRemove={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} />)
    fireEvent.click(screen.getByRole("combobox"))
    expect(screen.queryByRole("option", { name: "Rating" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "File Upload" })).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Short Text" })).toBeInTheDocument()
    expect(screen.queryByText("intakeForms.condition.add")).not.toBeInTheDocument()
  })

  it("locks editing controls for a field with saved responses", () => {
    render(<FieldEditor field={field} index={0} totalFields={1} disabled
      onChange={vi.fn()} onRemove={vi.fn()}
      onMoveUp={vi.fn()} onMoveDown={vi.fn()} />)
    expect(screen.getByRole("combobox")).toBeDisabled()
    expect(screen.getByPlaceholderText("intakeForms.field.labelArPlaceholder")).toBeDisabled()
    expect(screen.getByRole("switch")).toBeDisabled()
    expect(screen.getByRole("button", { name: "intakeForms.field.remove" })).toBeDisabled()
  })
})
