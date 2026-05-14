"use client"

import { Button } from "@deqah/ui"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import type { RefundType } from "@/lib/types/booking"
import { useLocale } from "@/components/locale-provider"

/* ─── Shared Types ─── */

interface CancelDialogState {
  refundType: RefundType
  setRefundType: (v: RefundType) => void
  refundAmount: string
  setRefundAmount: (v: string) => void
  adminNotes: string
  setAdminNotes: (v: string) => void
  loading: boolean
  onReset: () => void
}

/* ─── Approve Cancel Dialog ─── */

interface ApproveCancelDialogProps extends CancelDialogState {
  open: boolean
  suggestedRefundType: RefundType | null
  onApprove: () => void
}

export function ApproveCancelDialog({
  open,
  suggestedRefundType,
  refundType,
  setRefundType,
  refundAmount,
  setRefundAmount,
  adminNotes,
  setAdminNotes,
  loading,
  onReset,
  onApprove,
}: ApproveCancelDialogProps) {
  const { t } = useLocale()
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onReset()}>
      <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
        <SheetHeader>
          <SheetTitle>{t("bookings.cancel.approve.title")}</SheetTitle>
          <SheetDescription>{t("bookings.cancel.approve.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4">
          {suggestedRefundType && (
            <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
              {t("bookings.cancel.approve.systemSuggestion")}{" "}
              <span className="font-medium text-foreground">
                {suggestedRefundType === "full"
                  ? t("bookings.cancel.field.refundFull")
                  : suggestedRefundType === "partial"
                  ? t("bookings.cancel.field.refundPartial")
                  : t("bookings.cancel.field.refundNone")}
              </span>
            </p>
          )}
          <RefundTypeField value={refundType} onChange={setRefundType} />
          {refundType === "partial" && (
            <RefundAmountField value={refundAmount} onChange={setRefundAmount} />
          )}
          <AdminNotesField value={adminNotes} onChange={setAdminNotes} />
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onReset}>{t("bookings.cancel.button.dismiss")}</Button>
          <Button onClick={onApprove} disabled={loading}>
            {loading ? t("bookings.cancel.button.processing") : t("bookings.cancel.approve.button")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ─── Reject Cancel Dialog ─── */

interface RejectCancelDialogProps {
  open: boolean
  adminNotes: string
  setAdminNotes: (v: string) => void
  loading: boolean
  onReset: () => void
  onReject: () => void
}

export function RejectCancelDialog({
  open,
  adminNotes,
  setAdminNotes,
  loading,
  onReset,
  onReject,
}: RejectCancelDialogProps) {
  const { t } = useLocale()
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onReset()}>
      <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
        <SheetHeader>
          <SheetTitle>{t("bookings.cancel.reject.title")}</SheetTitle>
          <SheetDescription>{t("bookings.cancel.reject.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4">
          <AdminNotesField value={adminNotes} onChange={setAdminNotes} placeholder={t("bookings.cancel.reject.reasonPlaceholder")} />
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onReset}>{t("bookings.cancel.button.dismiss")}</Button>
          <Button onClick={onReject} disabled={loading}>
            {loading ? t("bookings.cancel.button.processing") : t("bookings.cancel.reject.button")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ─── Admin Cancel Dialog ─── */

interface AdminCancelDialogProps extends CancelDialogState {
  open: boolean
  cancelReason: string
  setCancelReason: (v: string) => void
  onCancel: () => void
}

export function AdminCancelDialog({
  open,
  cancelReason,
  setCancelReason,
  refundType,
  setRefundType,
  refundAmount,
  setRefundAmount,
  adminNotes,
  setAdminNotes,
  loading,
  onReset,
  onCancel,
}: AdminCancelDialogProps) {
  const { t } = useLocale()
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onReset()}>
      <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
        <SheetHeader>
          <SheetTitle>{t("bookings.cancel.admin.title")}</SheetTitle>
          <SheetDescription>{t("bookings.cancel.admin.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t("bookings.cancel.admin.reasonLabel")}</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t("bookings.cancel.admin.reasonPlaceholder")}
              rows={3}
            />
          </div>
          <RefundTypeField value={refundType} onChange={setRefundType} />
          {refundType === "partial" && (
            <RefundAmountField value={refundAmount} onChange={setRefundAmount} />
          )}
          <AdminNotesField value={adminNotes} onChange={setAdminNotes} />
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onReset}>{t("bookings.cancel.button.dismiss")}</Button>
          <Button variant="destructive" onClick={onCancel} disabled={loading}>
            {loading ? t("bookings.cancel.button.processing") : t("bookings.cancel.admin.button")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ─── Shared Field Components ─── */

function RefundTypeField({ value, onChange }: { value: RefundType; onChange: (v: RefundType) => void }) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-2">
      <Label>{t("bookings.cancel.field.refundType")}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as RefundType)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="full">{t("bookings.cancel.field.refundFull")}</SelectItem>
          <SelectItem value="partial">{t("bookings.cancel.field.refundPartial")}</SelectItem>
          <SelectItem value="none">{t("bookings.cancel.field.refundNone")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

function RefundAmountField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLocale()
  const numericValue = Number(value)
  const hasError = value !== "" && (isNaN(numericValue) || numericValue < 1)

  return (
    <div className="flex flex-col gap-2">
      <Label>{t("bookings.cancel.field.refundAmount")}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("bookings.cancel.field.refundAmountPlaceholder")}
        min={1}
        className="tabular-nums"
      />
      {hasError && (
        <p className="text-xs text-destructive">{t("bookings.cancel.field.refundAmountError")}</p>
      )}
    </div>
  )
}

function AdminNotesField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-2">
      <Label>{t("bookings.cancel.field.adminNotes")}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? t("bookings.cancel.field.adminNotesPlaceholder")} rows={3} />
    </div>
  )
}
