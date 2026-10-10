import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { useContactMessages } = vi.hoisted(() => ({ useContactMessages: vi.fn() }))
vi.mock("@/hooks/use-contact-messages", () => ({
  useContactMessages,
  useUpdateContactMessageStatus: () => ({ mutate: vi.fn() }),
}))
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    t: (k: string) => k === "contactMessages.resultCount" ? "count:{n}" : k,
  }),
}))
vi.mock("@/components/features/contact-messages/contact-message-columns", () => ({ getContactMessageColumns: () => [] }))
vi.mock("@/components/features/error-banner", () => ({ ErrorBanner: () => <div /> }))
vi.mock("@/components/features/data-table", () => ({ DataTable: (props: { onPageChange?: (page: number) => void }) => <button onClick={() => props.onPageChange?.(2)}>next-page</button> }))

import { ContactMessagesTable } from "@/components/features/contact-messages/contact-messages-table"

describe("ContactMessagesTable", () => {
  beforeEach(() => vi.clearAllMocks())

  it("keeps the filter visible during loading", () => {
    useContactMessages.mockReturnValue({data: undefined, isLoading: true})
    render(<ContactMessagesTable />)
    expect(screen.getByRole("combobox")).toBeVisible()
  })

  it("requests later pages instead of truncating the inbox at 50", () => {
    useContactMessages.mockReturnValue({ data: { items: [], meta: { total: 120, page: 1, totalPages: 3, hasPreviousPage: false, hasNextPage: true } }, isLoading: false })
    const { rerender } = render(<ContactMessagesTable />)
    expect(useContactMessages).toHaveBeenLastCalledWith({ status: undefined, page: 1, limit: 50 })
    fireEvent.click(screen.getByText("next-page"))
    rerender(<ContactMessagesTable />)
    expect(useContactMessages).toHaveBeenLastCalledWith({ status: undefined, page: 2, limit: 50 })
    expect(screen.getByText("count:120")).toBeInTheDocument()
  })
})
