"use client"

/**
 * Transfer Credit Form Body — Sawaa Dashboard
 *
 * Phase 5 — operator "practitioner left" tool. Renders a read-only
 * summary of the credit (service / practitioner / duration / remaining)
 * and a target-employee picker powered by `useServiceEmployees`.
 * The picker is filtered client-side to ACTIVE practitioners other
 * than the current owner; the backend re-validates the same
 * (service+duration) constraints on submit, so a mismatch returns
 * 400 with a clear message.
 *
 * UX gates:
 *   - The target picker is required and disabled until the service-
 *     employees list loads.
 *   - Submit is disabled while a transfer is in flight, no eligible
 *     target is selected, or the employees list is empty.
 *
 * Money is not involved — the price snapshot is FROZEN at purchase
 * time and never recomputed on transfer (see
 * apps/backend/src/modules/bookings/transfer-credit/transfer-credit.handler.ts).
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  Button,
  DialogBody,
  DialogFooter,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@sawaa/ui"

import { useServiceEmployees } from "@/hooks/use-services"
import { useTransferCredit } from "@/hooks/use-package-credit-ops"
import { useLocale } from "@/components/locale-provider"
import { showApiError } from "@/lib/mutation-helpers"
import {
  pickTransferTargetEmployees,
  type ServiceEmployeeOption,
} from "@/lib/types/credit-ops"
import type { PackageCredit } from "@/lib/types/package-purchase"

/* ─── Props ─── */

interface TransferCreditFormProps {
  credit: PackageCredit
  onClose: () => void
  onTransferred?: () => void
}

/* ─── Component ─── */

export function TransferCreditForm({
  credit,
  onClose,
  onTransferred,
}: TransferCreditFormProps) {
  const { t, locale } = useLocale()
  const { data: serviceEmployees, isLoading: employeesLoading } =
    useServiceEmployees(credit.serviceId)
  const transferMut = useTransferCredit()

  // Map the raw `ServiceEmployee` rows to the picker shape.
  const options = useMemo<ServiceEmployeeOption[]>(() => {
    if (!serviceEmployees) return []
    return serviceEmployees
      .filter((row) => row.isActive)
      .map((row) => {
        const first = row.employee.user.firstName ?? ""
        const last = row.employee.user.lastName ?? ""
        const full = `${first} ${last}`.trim()
        // The ServiceEmployee.employee type only carries nameAr (not
        // a top-level `name`); fall back to a composed user full-name.
        const displayName = row.employee.nameAr ?? full
        return {
          id: row.employee.id,
          displayName,
          isActive: row.employee.isActive,
          raw: row,
        }
      })
  }, [serviceEmployees])

  // Filter out the current owner so the picker never offers a no-op.
  const targetOptions = useMemo(
    () => pickTransferTargetEmployees(options, credit.employeeId),
    [options, credit.employeeId],
  )

  const [targetEmployeeId, setTargetEmployeeId] = useState<string>("")

  const canSubmit =
    !!credit.id &&
    !!targetEmployeeId &&
    targetEmployeeId !== credit.employeeId &&
    !transferMut.isPending &&
    !employeesLoading

  async function onSubmit() {
    if (!canSubmit) return
    try {
      await transferMut.mutateAsync({
        creditId: credit.id,
        payload: { toEmployeeId: targetEmployeeId },
      })
      toast.success(t("packages.balances.transfer.success"))
      onTransferred?.()
      onClose()
    } catch (err) {
      showApiError(err, {
        fallback: t("packages.balances.transfer.error"),
        t,
        dedupeKey: "transfer-credit-error",
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

          {/* ── Target employee picker ── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="transfer-credit-target">
              {t("packages.balances.transfer.target")}
            </Label>
            {employeesLoading ? (
              <Skeleton className="h-10 w-full rounded-md" />
            ) : targetOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("packages.balances.transfer.noTargets")}
              </p>
            ) : (
              <Select
                value={targetEmployeeId}
                onValueChange={setTargetEmployeeId}
              >
                <SelectTrigger id="transfer-credit-target" className="w-full">
                  <SelectValue
                    placeholder={t("packages.balances.transfer.targetPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              {t("packages.balances.transfer.helper")}
            </p>
          </div>
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
          {transferMut.isPending
            ? t("packages.balances.transfer.submitting")
            : t("packages.balances.transfer.submit")}
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
