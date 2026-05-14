"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Separator } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { fetchPayments } from "@/lib/api/payments"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import type { Payment } from "@/lib/types/payment"
import { PaymentActions } from "./payment-actions"

/* ─── Status Styles ─── */

const statusStyles: Record<string, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  paid: "border-success/30 bg-success/10 text-success",
  refunded: "border-info/30 bg-info/10 text-info",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
}

const verificationStyles: Record<string, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  matched: "border-success/30 bg-success/10 text-success",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  amount_differs: "border-warning/30 bg-warning/10 text-warning",
  suspicious: "border-destructive/30 bg-destructive/10 text-destructive",
  old_date: "border-muted-foreground/30 bg-muted text-muted-foreground",
  unreadable: "border-muted-foreground/30 bg-muted text-muted-foreground",
}

/* ─── Props ─── */

interface PaymentDetailSheetProps {
  paymentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: () => void
}

/* ─── Component ─── */

export function PaymentDetailSheet({
  paymentId,
  open,
  onOpenChange,
  onAction,
}: PaymentDetailSheetProps) {
  const { t } = useLocale()
  const { data: payment, isLoading } = useQuery({
    queryKey: queryKeys.payments.detail(paymentId ?? ""),
    queryFn: async () => {
      const res = await fetchPayments({ page: 1, perPage: 1 })
      return res.items.find((p) => p.id === paymentId) ?? null
    },
    enabled: !!paymentId && open,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("detail.paymentDetails")}</SheetTitle>
          <SheetDescription>
            {payment ? (
              <Badge
                variant="outline"
                className={statusStyles[payment.status] ?? ""}
              >
                {payment.status}
              </Badge>
            ) : (
              "Loading..."
            )}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <SheetBody>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={`skeleton-${i}`} className="h-16 rounded-lg" />
              ))}
            </div>
          </SheetBody>
        ) : payment ? (
          <PaymentDetailBody payment={payment} onAction={onAction} />
        ) : null}
      </SheetContent>
    </Sheet>
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

  const clientName = payment.booking?.client
    ? `${payment.booking.client.firstName} ${payment.booking.client.lastName}`
    : "\u2014"

  const employeeName = payment.booking?.employee?.user
    ? `${payment.booking.employee.user.firstName} ${payment.booking.employee.user.lastName}`
    : "\u2014"

  return (
    <>
      <SheetBody>
        <div className="flex flex-col gap-6">
          {/* Amount */}
          <DetailSection title={t("detail.payment")}>
            <DetailRow
              label={t("detail.id")}
              value={payment.id.slice(0, 12)}
              numeric
            />
            <DetailRow
              label={t("detail.total")}
              value={<FormattedCurrency amount={payment.totalAmount} locale={locale} decimals={2} />}
              numeric
            />
            <DetailRow
              label={t("detail.tax")}
              value={<FormattedCurrency amount={payment.vatAmount} locale={locale} decimals={2} />}
              numeric
            />
            <DetailRow
              label={t("detail.method")}
              value={payment.method === "bank_transfer" ? t("detail.bankTransfer") : t("detail.moyasar")}
            />
            {payment.transactionRef && (
              <DetailRow label={t("detail.transactionRef")} value={payment.transactionRef} numeric />
            )}
          </DetailSection>

          <Separator />

          {/* Booking */}
          <DetailSection title={t("nav.bookings")}>
            <DetailRow label={t("detail.client")} value={clientName} />
            <DetailRow label={t("detail.employee")} value={employeeName} />
            <DetailRow
              label={t("detail.service")}
              value={payment.booking?.service?.nameEn ?? "\u2014"}
            />
            <DetailRow
              label={t("detail.date")}
              value={
                payment.booking?.date
                  ? formatDate(payment.booking.date)
                  : "\u2014"
              }
              numeric
            />
          </DetailSection>

          {/* Bank Transfer Receipts */}
          {payment.receipts && payment.receipts.length > 0 && (
            <>
              <Separator />
              <DetailSection title={t("detail.receipts")}>
                {payment.receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={
                          verificationStyles[receipt.aiVerificationStatus] ?? ""
                        }
                      >
                        {receipt.aiVerificationStatus}
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
      </SheetBody>

      <SheetFooter>
        <PaymentActions payment={payment} onAction={onAction} />
      </SheetFooter>
    </>
  )
}
