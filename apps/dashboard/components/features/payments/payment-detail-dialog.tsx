"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Textarea,
} from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { fetchPayment } from "@/lib/api/payments"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"
import { usePaymentMutations } from "@/hooks/use-payments"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { showApiError } from "@/lib/mutation-helpers"
import { sarToHalalas, halalasToSar } from "@/lib/money"
import type { Payment } from "@/lib/types/payment"
import { PaymentActions } from "./payment-actions"
import { PaymentStatusBadge } from "@/components/features/status-badge"
import { cn } from "@/lib/utils"

/* ─── Status key maps ─── */

const PAYMENT_STATUS_KEYS: Record<string, string> = {
  PENDING: "payments.status.pending",
  PENDING_VERIFICATION: "payments.status.waiting",
  COMPLETED: "payments.status.paid",
  REFUNDED: "payments.status.refunded",
  FAILED: "payments.status.failed",
}

const methodKey: Record<string, string> = {
  BANK_TRANSFER: "detail.bankTransfer",
  ONLINE_CARD: "detail.moyasar",
  CASH: "detail.paymentMethod.cash",
}

const VERIFICATION_STATUS_KEYS: Record<string, string> = {
  pending: "payments.verification.pending",
  matched: "payments.verification.matched",
  approved: "payments.verification.approved",
  rejected: "payments.verification.rejected",
  amount_differs: "payments.verification.amountDiffers",
  suspicious: "payments.verification.suspicious",
  old_date: "payments.verification.oldDate",
  unreadable: "payments.verification.unreadable",
}

const verificationStyles: Record<string, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  matched: "border-success/30 bg-success/10 text-success",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-error/30 bg-error/10 text-error",
  amount_differs: "border-warning/30 bg-warning/10 text-warning",
  suspicious: "border-error/30 bg-error/10 text-error",
  old_date: "border-muted-foreground/30 bg-muted text-muted-foreground",
  unreadable: "border-muted-foreground/30 bg-muted text-muted-foreground",
}

/* ─── Props ─── */

interface PaymentDetailDialogProps {
  paymentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: () => void
}

/* ─── Component ─── */

export function PaymentDetailDialog({
  paymentId,
  open,
  onOpenChange,
  onAction,
}: PaymentDetailDialogProps) {
  const { t } = useLocale()
  const { data: payment, isLoading } = useQuery({
    queryKey: queryKeys.payments.detail(paymentId ?? ""),
    queryFn: () => fetchPayment(paymentId ?? ""),
    enabled: !!paymentId && open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("detail.paymentDetails")}</DialogTitle>
          <DialogDescription asChild>
            {payment ? (
              <PaymentStatusBadge
                status={payment.status}
                label={t(PAYMENT_STATUS_KEYS[payment.status] ?? "payments.status.pending")}
              />
            ) : (
              <span>{t("common.loading")}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <DialogBody>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={`skeleton-${i}`} className="h-16 rounded-lg" />
              ))}
            </div>
          </DialogBody>
        ) : payment ? (
          <PaymentDetailBody payment={payment} onAction={onAction} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Detail Body ─── */

function PaymentDetailBody({
  payment,
  onAction,
}: {
  payment: Payment
  onAction: () => void
}) {
  const { formatDate } = useOrganizationConfig()
  const { locale, t } = useLocale()
  // Refund is an inline step inside THIS dialog — never a second stacked modal.
  const [mode, setMode] = useState<"details" | "refund">("details")

  if (mode === "refund") {
    return (
      <PaymentRefundStep
        payment={payment}
        onBack={() => setMode("details")}
        onDone={() => {
          onAction()
          setMode("details")
        }}
      />
    )
  }

  return (
    <>
      <DialogBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
          {/* Amount */}
          <DetailSection title={t("detail.payment")}>
            <DetailRow
              label={t("detail.id")}
              value={payment.id.slice(0, 12)}
              numeric
            />
            <DetailRow
              label={t("detail.total")}
              value={<FormattedCurrency amount={Number(payment.amount)} locale={locale} decimals={2} />}
              numeric
            />
            <DetailRow
              label={t("detail.method")}
              value={methodKey[payment.method] ? t(methodKey[payment.method]) : payment.method}
            />
            {payment.gatewayRef && (
              <DetailRow label={t("detail.transactionRef")} value={payment.gatewayRef} numeric />
            )}
          </DetailSection>

          {/* Invoice */}
          <DetailSection title={t("detail.invoice.title")}>
            <DetailRow label={t("detail.invoiceId")} value={payment.invoiceId?.slice(0, 12) ?? "—"} numeric />
          </DetailSection>

          {/* Bank Transfer Receipts */}
          {payment.receipts && payment.receipts.length > 0 && (
            <>
              <DetailSection title={t("detail.receipts")} className="sm:col-span-2">
                {payment.receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold ps-2.5 pe-2.5 py-0.5 text-[11px] tracking-tight rounded-md",
                          verificationStyles[receipt.aiVerificationStatus] ?? "",
                        )}
                      >
                        {t(VERIFICATION_STATUS_KEYS[receipt.aiVerificationStatus] ?? "payments.verification.pending")}
                      </Badge>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatDate(receipt.createdAt)}
                      </span>
                    </div>

                    {receipt.aiConfidence != null && (
                      <p className="tabular-nums text-xs text-muted-foreground">
                        {t("detail.aiConfidence")}: {(receipt.aiConfidence * 100).toFixed(0)}%
                      </p>
                    )}

                    {receipt.adminNotes && (
                      <p className="text-xs text-muted-foreground">
                        {t("detail.notes")}: {receipt.adminNotes}
                      </p>
                    )}
                  </div>
                ))}
              </DetailSection>
            </>
          )}
        </div>
      </DialogBody>

      <DialogFooter>
        <PaymentActions payment={payment} onAction={onAction} onRefund={() => setMode("refund")} />
      </DialogFooter>
    </>
  )
}

/* ─── Inline refund step (replaces the detail content; no stacked modal) ─── */

function PaymentRefundStep({
  payment,
  onBack,
  onDone,
}: {
  payment: Payment
  onBack: () => void
  onDone: () => void
}) {
  const { t } = useLocale()
  const { refundMut, manualRefundMut } = usePaymentMutations()

  // Off-gateway payments (cash/mada/bank-transfer, no gatewayRef) refund through
  // the manual path; card/gateway payments go through Moyasar.
  const isManual = !payment.gatewayRef
  const mut = isManual ? manualRefundMut : refundMut

  const maxSar = halalasToSar(Math.max(Number(payment.amount) - Number(payment.refundedAmount ?? 0), 0))
  const [reason, setReason] = useState("")
  const [amountSar, setAmountSar] = useState("")

  const amountNum = Number(amountSar) || 0
  const amountValid = !amountSar || (amountNum > 0 && amountNum <= maxSar)
  const canSubmit = reason.trim().length > 0 && amountValid && !mut.isPending

  async function onSubmit() {
    try {
      await mut.mutateAsync({
        id: payment.id,
        reason: reason.trim(),
        amount: amountSar ? sarToHalalas(amountNum) : undefined,
      })
      toast.success(t("refund.successToast"))
      onDone()
    } catch (err) {
      showApiError(err, { fallback: t("refund.errorToast"), t })
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-200">
      <DialogBody>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("refund.description")}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-refund-reason">{t("refund.reasonLabel")}</Label>
            <Textarea
              id="payment-refund-reason"
              placeholder={t("refund.reasonPlaceholder")}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-refund-amount">
              {t("refund.amountLabel")}
              <span className="ms-1 font-numeric text-muted-foreground tabular-nums">
                {t("refund.amountMax").replace("{max}", String(maxSar))}
              </span>
            </Label>
            <Input
              id="payment-refund-amount"
              type="number"
              min={0.01}
              step={0.01}
              max={maxSar}
              placeholder={t("refund.amountPlaceholder")}
              className="tabular-nums"
              value={amountSar}
              onChange={(e) => setAmountSar(e.target.value)}
            />
            {!amountValid && <p className="text-xs text-error">{t("refund.validation.invalidAmount")}</p>}
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          {t("common.back")}
        </Button>
        <Button type="button" size="sm" disabled={!canSubmit} onClick={onSubmit}>
          {mut.isPending ? t("refund.submitting") : t("refund.submit")}
        </Button>
      </DialogFooter>
    </div>
  )
}
