"use client"

import { useRef, useState } from "react"
import { Button, Label, Textarea } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { useRefundReviewMutation } from "@/hooks/use-refund-review-mutations"
import type { Payment, PaymentRefundRequest } from "@/lib/types/payment"

export function PaymentRefundRequests({ payment }: { payment: Payment }) {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const canReview = payment.gatewayRef ? canDo("setting", "manage") : canDo("invoice", "manage")
  return <section className="flex flex-col gap-3 sm:col-span-2" aria-label={t("refund.review.title")}>
    <h3 className="text-sm font-semibold">{t("refund.review.title")}</h3>
    <p className="text-sm text-muted-foreground">{t("refund.review.description")}</p>
    {payment.refundRequests?.map((request) => <RefundRequestRow key={request.id} payment={payment} request={request} canReview={canReview} />)}
  </section>
}

function RefundRequestRow({ payment, request, canReview }: { payment: Payment; request: PaymentRefundRequest; canReview: boolean }) {
  const { t, locale } = useLocale()
  const mutation = useRefundReviewMutation(payment)
  const [reason, setReason] = useState("")
  const [returned, setReturned] = useState(false)
  const [error, setError] = useState(false)
  const [result, setResult] = useState<string>()
  const submitting = useRef(false)
  const status = request.status === "PENDING_REVIEW" ? result ?? request.status : request.status
  const pending = status === "PENDING_REVIEW" && canReview
  const manual = !payment.gatewayRef
  const reasonId = `refund-review-reason-${request.id}`
  const knownStatus = ["PENDING_REVIEW", "PROCESSING", "COMPLETED", "FAILED", "DENIED", "MANUAL_REVIEW"].includes(status)

  async function submit(action: "settle" | "approve" | "deny") {
    if (submitting.current || !pending || (action !== "approve" && !reason.trim()) || (action === "settle" && !returned)) return
    submitting.current = true
    setError(false)
    try {
      const response = await mutation.mutateAsync(action === "settle"
        ? { action, refundRequestId: request.id, reason: reason.trim(), amount: request.amount }
        : action === "deny" ? { action, refundRequestId: request.id, reason: reason.trim() }
        : { action, refundRequestId: request.id })
      setResult(response.status)
    } catch {
      setError(true)
    } finally { submitting.current = false }
  }

  return <div className="flex flex-col gap-3 rounded-lg border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <FormattedCurrency amount={request.amount} locale={locale} decimals={2} />
      <p role="status" className="text-sm">{t(`refund.review.status.${knownStatus ? status : "UNKNOWN"}`)}</p>
    </div>
    {request.reason && <p className="text-sm text-muted-foreground">{request.reason}</p>}
    {pending && <>
      <Label htmlFor={reasonId}>{t("refund.reasonLabel")}</Label>
      <Textarea id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} disabled={mutation.isPending} />
      {manual && <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={returned} onChange={(event) => setReturned(event.target.checked)} disabled={mutation.isPending} className="mt-1" />
        {t("refund.review.returnedConfirmation")}
      </label>}
      {error && <p role="alert" className="text-sm text-error">{t("refund.errorToast")}</p>}
      <div className="flex flex-wrap gap-2" aria-busy={mutation.isPending}>
        {manual ? <Button type="button" disabled={mutation.isPending || !reason.trim() || !returned} onClick={() => void submit("settle")}>
          {t("refund.review.recordReturn")}
        </Button> : <>
          <Button type="button" disabled={mutation.isPending} onClick={() => void submit("approve")}>{t("refund.review.approve")}</Button>
          <Button type="button" variant="outline" disabled={mutation.isPending || !reason.trim()} onClick={() => void submit("deny")}>{t("refund.review.deny")}</Button>
        </>}
      </div>
    </>}
  </div>
}
