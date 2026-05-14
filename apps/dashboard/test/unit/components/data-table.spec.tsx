import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { type ColumnDef } from "@tanstack/react-table"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "table.noResults": "لا توجد نتائج",
        "table.noData": "لا توجد بيانات",
        "table.previous": "السابق",
        "table.next": "التالي",
        "table.page": "صفحة",
        "table.of": "من",
      }
      return map[k] ?? k
    },
    toggleLocale: vi.fn(),
  }),
}))

import { DataTable } from "@/components/features/data-table"

interface TestRow {
  id: string
  name: string
  email: string
}

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: "name", header: "الاسم" },
  { accessorKey: "email", header: "البريد" },
]

const data: TestRow[] = [
  { id: "1", name: "أحمد", email: "ahmed@test.com" },
  { id: "2", name: "سارة", email: "sara@test.com" },
]

describe("DataTable", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("renders table rows from data", () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText("أحمد")).toBeInTheDocument()
    expect(screen.getByText("سارة")).toBeInTheDocument()
    expect(screen.getByText("ahmed@test.com")).toBeInTheDocument()
  })

  it("renders column headers", () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText("الاسم")).toBeInTheDocument()
    expect(screen.getByText("البريد")).toBeInTheDocument()
  })

  it("shows empty state when no data", () => {
    render(<DataTable columns={columns} data={[]} emptyTitle="فارغ" emptyDescription="لا بيانات" />)
    expect(screen.getByText("فارغ")).toBeInTheDocument()
    expect(screen.getByText("لا بيانات")).toBeInTheDocument()
  })

  it("renders empty action button when provided", () => {
    const onClick = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyTitle="فارغ"
        emptyAction={{ label: "إضافة", onClick }}
      />,
    )
    const btn = screen.getByRole("button", { name: "إضافة" })
    expect(btn).toBeInTheDocument()
  })

  it("shows pagination when more than one page", () => {
    const manyRows = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      name: `اسم ${i}`,
      email: `user${i}@test.com`,
    }))

    render(<DataTable columns={columns} data={manyRows} />)
    expect(screen.getByText(/صفحة/)).toBeInTheDocument()
    expect(screen.getByText(/التالي/)).toBeInTheDocument()
  })

  it("does not show pagination for single page", () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.queryByText(/صفحة/)).toBeNull()
  })
})
