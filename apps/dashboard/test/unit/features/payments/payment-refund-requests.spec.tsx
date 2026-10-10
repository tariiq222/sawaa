import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PaymentRefundRequests } from "@/components/features/payments/payment-refund-requests"
import type { Payment } from "@/lib/types/payment"

const { patch, post, canDo } = vi.hoisted(() => ({ patch: vi.fn(), post: vi.fn(), canDo: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { patch, post } }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ canDo }) }))
vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ locale: "en", t: (key: string) => key }) }))
vi.mock("@sawaa/ui", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))
const request = { id: "req-1", amount: 2500, status: "PENDING_REVIEW" as const, reason: "Cancellation", createdAt: "2026-10-03T09:00:00Z" }
const payment = { id: "pay-1", invoiceId: "inv-1", invoice: { bookingId: "booking-1", clientId: "client-1" }, method: "CASH", gatewayRef: null, refundRequests: [request] } as Payment
function setup(value = payment) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 3 } } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(<QueryClientProvider client={client}><PaymentRefundRequests payment={value} /></QueryClientProvider>)
  return { invalidate }
}
function fillReason() { fireEvent.change(screen.getByLabelText("refund.reasonLabel"), { target: { value: "Money returned at reception" } }) }
beforeEach(() => { vi.resetAllMocks(); canDo.mockReturnValue(true) })
describe("payment refund requests", () => {
  it("requires reason and actual return confirmation, then settles the exact cash request in halalas", async () => {
    patch.mockResolvedValue({ ...payment, status: "PARTIALLY_REFUNDED" })
    const { invalidate } = setup()
    expect(screen.getByText("25.00")).toBeInTheDocument()
    const submit = screen.getByRole("button", { name: "refund.review.recordReturn" })
    expect(submit).toBeDisabled()
    fillReason()
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: "refund.review.returnedConfirmation" }))
    fireEvent.click(submit)
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/dashboard/finance/payments/pay-1/manual-refund", { reason: "Money returned at reception", refundRequestId: "req-1", amount: 2500 }))
    expect(await screen.findByText("refund.review.status.COMPLETED")).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["payments", "detail", "pay-1"] }))
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["bookings", "detail", "booking-1"] }))
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["invoices", "detail", "inv-1"] }))
    expect(post).not.toHaveBeenCalled()
  })
  it("keeps a processing gateway approval distinct from completion", async () => {
    post.mockResolvedValue({ id: "req-1", status: "PROCESSING" })
    setup({ ...payment, method: "ONLINE_CARD", gatewayRef: "gateway-1" })
    fireEvent.click(screen.getByRole("button", { name: "refund.review.approve" }))
    await waitFor(() => expect(post).toHaveBeenCalledWith("/dashboard/refunds/approve", { refundRequestId: "req-1" }))
    expect(await screen.findByText("refund.review.status.PROCESSING")).toBeInTheDocument()
    expect(screen.queryByText("refund.review.status.COMPLETED")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "refund.review.approve" })).not.toBeInTheDocument()
  })
  it("requires a reason to deny and never mutates the booking", async () => {
    post.mockResolvedValue({ id: "req-1", status: "DENIED" })
    setup({ ...payment, method: "ONLINE_CARD", gatewayRef: "gateway-1" })
    const deny = screen.getByRole("button", { name: "refund.review.deny" })
    expect(deny).toBeDisabled()
    fillReason(); fireEvent.click(deny)
    expect(await screen.findByText("refund.review.status.DENIED")).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith("/dashboard/refunds/deny", { refundRequestId: "req-1", reason: "Money returned at reception" })
    expect(patch).not.toHaveBeenCalled()
  })
  it.each([null, "bank-transfer-admin-reference"])(
    "settles a bank transfer with reference %s using update:Payment",
    async (gatewayRef) => {
      canDo.mockImplementation(
        (subject: string, action: string) =>
          subject === "payment" && action === "update"
      )
      patch.mockResolvedValue({ ...payment, status: "PARTIALLY_REFUNDED" })
      setup({ ...payment, method: "BANK_TRANSFER", gatewayRef })
      expect(
        screen.queryByRole("button", { name: "refund.review.approve" })
      ).not.toBeInTheDocument()
      expect(canDo).toHaveBeenCalledWith("payment", "update")
      fillReason()
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "refund.review.returnedConfirmation",
        })
      )
      fireEvent.click(
        screen.getByRole("button", { name: "refund.review.recordReturn" })
      )
      await waitFor(() =>
        expect(patch).toHaveBeenCalledWith(
          "/dashboard/finance/payments/pay-1/manual-refund",
          {
            reason: "Money returned at reception",
            refundRequestId: "req-1",
            amount: 2500,
          }
        )
      )
      expect(
        await screen.findByText("refund.review.status.COMPLETED")
      ).toBeInTheDocument()
      expect(post).not.toHaveBeenCalled()
    }
  )
  it.each([
    ["CASH", null, "payment", "update"],
    ["BANK_TRANSFER", "bank-transfer-admin-reference", "payment", "update"],
    ["ONLINE_CARD", "gateway-1", "setting", "manage"],
  ] as const)(
    "hides %s actions without their endpoint permission",
    (method, gatewayRef, subject, action) => {
      canDo.mockImplementation((candidate: string) => candidate === "invoice")
      setup({ ...payment, method, gatewayRef })
      expect(screen.queryAllByRole("button")).toHaveLength(0)
      expect(canDo).toHaveBeenCalledWith(subject, action)
    }
  )
  it("preserves the row on errors without automatic retry and permits an explicit retry", async () => {
    post.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ id: "req-1", status: "COMPLETED" })
    setup({ ...payment, method: "ONLINE_CARD", gatewayRef: "gateway-1" })
    fireEvent.click(screen.getByRole("button", { name: "refund.review.approve" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("refund.errorToast")
    expect(post).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "refund.review.approve" }))
    expect(await screen.findByText("refund.review.status.COMPLETED")).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(2)
  })
  it("blocks duplicate submissions while busy", async () => {
    post.mockReturnValue(new Promise(() => {}))
    setup({ ...payment, method: "ONLINE_CARD", gatewayRef: "gateway-1" })
    const approve = screen.getByRole("button", { name: "refund.review.approve" })
    fireEvent.click(approve); fireEvent.click(approve)
    await waitFor(() => expect(approve).toBeDisabled())
    expect(post).toHaveBeenCalledTimes(1)
  })
  it.each(["COMPLETED", "FAILED", "DENIED", "MANUAL_REVIEW"] as const)("renders persisted %s without an actionable review", (status) => {
    setup({ ...payment, refundRequests: [{ ...request, status }] })
    expect(screen.getByText(`refund.review.status.${status}`)).toBeInTheDocument()
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })
})
