"use client"

/**
 * Credit-Book Form Body — Sawaa Dashboard
 *
 * Phase 3 — explicit "Book appointment from credit" entry. Renders
 * branch + day + time + optional notes, owning the submit state. Pre-
 * filled from the parent credit row's (service, employee, duration);
 * the operator only chooses branch + when. Submission POSTs
 * /dashboard/bookings/from-credit with the explicit `creditId` so the
 * backend consumes the chosen bucket instead of FIFO-selecting.
 *
 * `combineDateTimeToISO` mirrors the same Asia/Riyadh-aware helper the
 * normal booking flow uses — keeping the wire format identical to what
 * the regular create-booking endpoint accepts.
 *
 * UX gates:
 *   - Branch required (default to the main branch if it has one).
 *   - Day + time required (no past dates — the backend rejects with
 *     400 "Booking must be scheduled in the future").
 *   - Notes optional, ≤2000 chars (matches BookFromCreditDto).
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  Button,
  DialogBody,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@sawaa/ui"

import { useBranches } from "@/hooks/use-branches"
import { useBookFromCredit } from "@/hooks/use-credit-bookings"
import { useLocale } from "@/components/locale-provider"
import { DatePicker } from "@/components/ui/date-picker"
import { showApiError } from "@/lib/mutation-helpers"
import { combineDateTimeToISO } from "@/lib/utils"
import type { PackageCredit } from "@/lib/types/package-purchase"

/* ─── Props ─── */

interface CreditBookFormProps {
  clientId: string
  credit: PackageCredit
  onClose: () => void
  onBooked?: () => void
}

/* ─── Component ─── */

export function CreditBookForm({
  clientId,
  credit,
  onClose,
  onBooked,
}: CreditBookFormProps) {
  const { t, locale } = useLocale()
  const { branches, isLoading: branchesLoading } = useBranches()
  const bookMut = useBookFromCredit()

  const activeBranches = useMemo(
    () => (branches ?? []).filter((b) => b.isActive),
    [branches],
  )
  const mainBranch = useMemo(
    () => activeBranches.find((b) => b.isMain) ?? activeBranches[0] ?? null,
    [activeBranches],
  )

  const [userBranchId, setUserBranchId] = useState<string>("")
  const [date, setDate] = useState<string>("")
  const [time, setTime] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

  // Effective branch = user choice → main branch → first active. Computed
  // as a derived value (avoids setState-in-effect anti-pattern).
  const branchId = userBranchId || mainBranch?.id || ""

  const timeRegex = /^\d{2}:\d{2}$/
  const isTimeValid = timeRegex.test(time)

  const canSubmit =
    !!clientId &&
    !!credit?.id &&
    !!branchId &&
    !!date &&
    isTimeValid &&
    !bookMut.isPending &&
    !branchesLoading

  async function onSubmit() {
    if (!canSubmit) return
    const scheduledAt = combineDateTimeToISO(date, time)
    if (!scheduledAt) {
      toast.error(t("packages.balances.book.timeUnavailable"))
      return
    }
    try {
      await bookMut.mutateAsync({
        clientId,
        creditId: credit.id,
        branchId,
        scheduledAt,
        notes: notes.trim() || undefined,
      })
      toast.success(t("packages.balances.book.success"))
      onBooked?.()
      onClose()
    } catch (err) {
      showApiError(err, {
        fallback: t("packages.balances.book.error"),
        t,
        dedupeKey: "credit-book-error",
      })
    }
  }

  const serviceName =
    locale === "ar"
      ? credit.serviceNameAr
      : (credit.serviceNameEn ?? credit.serviceNameAr)
  const employeeName =
    locale === "ar"
      ? credit.employeeNameAr
      : (credit.employeeNameEn ?? credit.employeeNameAr)
  const durationLabel =
    locale === "ar"
      ? credit.durationLabelAr
      : (credit.durationLabelEn ?? credit.durationLabelAr)

  return (
    <>
      <DialogBody>
        <div className="flex flex-col gap-4">
          {/* ── Read-only credit summary ── */}
          <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
            <SummaryRow
              label={t("packages.balances.book.summary.service")}
              value={serviceName}
            />
            <SummaryRow
              label={t("packages.balances.book.summary.employee")}
              value={employeeName}
            />
            <SummaryRow
              label={t("packages.balances.book.summary.duration")}
              value={durationLabel}
            />
            <SummaryRow
              label={t("packages.balances.book.summary.remaining")}
              value={String(credit.remaining)}
            />
          </div>

          {/* ── Branch selector ── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="credit-book-branch">
              {t("packages.balances.book.branch")}
            </Label>
            {branchesLoading ? (
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            ) : activeBranches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("packages.balances.book.noBranches")}
              </p>
            ) : (
              <Select value={branchId} onValueChange={setUserBranchId}>
                <SelectTrigger id="credit-book-branch" className="w-full">
                  <SelectValue
                    placeholder={t("packages.balances.book.branchPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {locale === "ar" ? b.nameAr : b.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Day + time (DatePicker + HH:MM time input, no native date/datetime-local) ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t("packages.balances.book.date")}</Label>
              <DatePicker
                value={date}
                onChange={setDate}
                aria-label={t("packages.balances.book.date")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="credit-book-time">
                {t("packages.balances.book.time")}
              </Label>
              <Input
                id="credit-book-time"
                type="time"
                dir="ltr"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder={t("packages.balances.book.timePlaceholder")}
                aria-label={t("packages.balances.book.time")}
              />
            </div>
          </div>

          {/* ── Notes (optional) ── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="credit-book-notes">
              {t("packages.balances.book.notes")}
            </Label>
            <Textarea
              id="credit-book-notes"
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("packages.balances.book.notesPlaceholder")}
            />
          </div>

          {(!branchId || !date || !time) && (
            <p className="text-xs text-muted-foreground">
              {!branchId
                ? t("packages.balances.book.required.branch")
                : t("packages.balances.book.required.dateTime")}
            </p>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("packages.balances.book.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {bookMut.isPending
            ? t("packages.balances.book.submitting")
            : t("packages.balances.book.submit")}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ─── Read-only row ─── */

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}