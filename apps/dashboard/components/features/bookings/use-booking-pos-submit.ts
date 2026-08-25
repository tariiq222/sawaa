"use client"

// EXCEPTION: hook size limit (200) exceeded — 2026-08-23 — Phase 6
// extracted the booking-pos `handleSubmit` (with its track-aware
// GROUP guard and the useCredit / paid branches) into a custom hook
// so `booking-pos.tsx` stays under the 350-line absolute limit.
//
// W1-T4 update — 2026-08-25 — collapsed the W2-T2 two-call "collect-now"
// sequence (ensureBookingInvoice + recordPayment) into the single
// `collectMut` introduced in `useRecordPaymentMutations` by the
// parallel W1-T2 stream. The contract is unchanged: when the operator
// picked "تحصيل الآن" (payAtClinic === false), the hook now makes
// ONE server round-trip — the server materialises the invoice if
// needed AND records the full outstanding amount against it.
//
// We deliberately do NOT compute the amount client-side and we do
// NOT send a discount payload from this hook — both are server
// concerns. The booking is already CREATED before this call runs, so
// a failure here is NOT a compensating delete/cancel surface — we
// still close the wizard and surface the dedicated `paymentRecordFailed`
// toast so the operator records the payment from the booking details
// screen rather than booking through the wizard again.
//
// The credit branch above is intentionally left untouched and is
// the financial-surface sacred ground mentioned by the user
// ("انتبه التعديل. ياثر علي العمليات الموجوده لان فيه بيانات ما
// نبيها تكسر").

import { useCallback } from "react"
import { toast } from "sonner"

import { useLocale } from "@/components/locale-provider"
import { useBookingMutations } from "@/hooks/use-bookings"
import { useBookFromCredit } from "@/hooks/use-credit-bookings"
import { useRecordPaymentMutations } from "@/hooks/use-payments"
import { usePaymentSettings } from "@/hooks/use-organization-settings"
import { showApiError } from "@/lib/mutation-helpers"
import { combineDateTimeToISO } from "@/lib/utils"
import { bookingPosPayloadSchema } from "@/lib/schemas/booking.schema"
import { resolveActiveMethod } from "@/components/features/shared/payment-method-picker"

import type { BookingFormState } from "./use-booking-form-state"

interface UseBookingPosSubmitArgs {
  state: BookingFormState
  mainBranch: { id: string } | undefined
  useCredit: boolean
  reset: () => void
  onSuccess: () => void
}

export function useBookingPosSubmit({
  state,
  mainBranch,
  useCredit,
  reset,
  onSuccess,
}: UseBookingPosSubmitArgs): {
  submit: () => Promise<void>
  isSubmitting: boolean
} {
  const { t } = useLocale()
  const { createMut } = useBookingMutations()
  const bookFromCreditMut = useBookFromCredit()
  // W1-T4 — collect-now is now a SINGLE `collectMut` round-trip added
  // by the parallel W1-T2 stream to `useRecordPaymentMutations`. The
  // server resolves the invoice + records the full outstanding amount
  // in one call; we deliberately do NOT compute amount client-side
  // and we do NOT send a discount payload from this hook.
  const { collectMut } = useRecordPaymentMutations()
  const { data: paymentSettings } = usePaymentSettings()

  const isSubmitting =
    createMut.isPending ||
    bookFromCreditMut.isPending ||
    collectMut.isPending

  const submit = useCallback(async () => {
    // Phase 6 — GROUP track is closed by handleProgramEnrolled the
    // moment StepProgram's enrollment succeeds. handleSubmit must
    // NEVER create a second booking for this track.
    if (state.track === "GROUP") return

    if (
      !state.clientId ||
      !state.serviceId ||
      !state.employeeId ||
      !state.deliveryType ||
      !state.date ||
      !state.startTime
    ) return

    // PACKAGES-track sessions and the auto-detect "احجز من الرصيد" badge
    // both must post to /from-credit. `packagePurchaseId` is the source of
    // truth for the PACKAGES track (handlePackageCreditSelected flips
    // useCredit=true, but any subsequent edit could clear it while the
    // purchase id stays set — using packagePurchaseId directly prevents the
    // double-charge bug from regressing).
    //
    // W1-T4 — the credit branch remains COMPLETELY UNTOUCHED: it must
    // still post to /from-credit, still send no payAtClinic, and must
    // never call collectMut — package-credit bookings are zero-priced
    // and pre-paid.
    if (useCredit || state.packagePurchaseId) {
      if (!state.durationOptionId || !mainBranch?.id) {
        toast.error(t("bookings.wizard.submitError"))
        return
      }
      const scheduledAt = combineDateTimeToISO(state.date, state.startTime)
      if (!scheduledAt) {
        toast.error(t("bookings.wizard.submitError"))
        return
      }
      try {
        await bookFromCreditMut.mutateAsync({
          clientId: state.clientId,
          serviceId: state.serviceId,
          employeeId: state.employeeId,
          durationOptionId: state.durationOptionId,
          branchId: mainBranch.id,
          scheduledAt,
          deliveryType: state.deliveryType,
          // W3-T9 — FLEXIBLE path only: pin the exact PackageCredit id the
          // operator picked. Without `creditId`, the backend FIFO/specificity
          // matcher could debit a different overlapping package on a client
          // who holds two eligible credits. The triple is still required so
          // the backend can validate the target against the credit's
          // constraints (`creditMatchesTarget` in the handler). The PINNED
          // path keeps the payload byte-identical by omitting the key.
          ...(state.creditFilter ? { creditId: state.creditFilter.creditId } : {}),
        })
        toast.success(t("bookings.credit.toast.success"))
        reset()
        onSuccess()
      } catch (err) {
        showApiError(err, {
          fallback: t("bookings.credit.toast.error"),
          t,
          dedupeKey: "credit-book-error",
        })
      }
      return
    }

    const payload = {
      clientId: state.clientId,
      employeeId: state.employeeId,
      serviceId: state.serviceId,
      type: "individual" as const,
      deliveryType: state.deliveryType,
      durationOptionId: state.durationOptionId ?? undefined,
      date: state.date,
      startTime: state.startTime,
      payAtClinic: state.payAtClinic,
      branchId: mainBranch?.id,
      couponCode: state.couponCode ?? undefined,
    }
    const validation = bookingPosPayloadSchema.safeParse(payload)
    if (!validation.success) {
      toast.error(t("bookings.wizard.submitError"))
      return
    }
    try {
      const created = await createMut.mutateAsync(validation.data)

      // W1-T4 — only the PAID branch AND only when the operator picked
      // "تحصيل الآن" (payAtClinic === false) do we collect the full
      // outstanding payment. The credit branch above already returned;
      // nothing below this line touches it.
      if (created && !state.payAtClinic) {
        try {
          const method = resolveActiveMethod(
            paymentSettings,
            state.collectionMethod,
          )
          const result = await collectMut.mutateAsync({
            bookingId: created.id,
            method,
          })
          // Backend truth: when the booking has zero outstanding (e.g.
          // a 100%-discount or coupon edge case), the server returns
          // `payment: null`. The booking is legitimately created; close
          // the wizard and only toast paymentRecorded when a payment
          // actually landed.
          if (result?.payment) {
            toast.success(t("bookings.wizard.step.confirm.paymentRecorded"))
          }
        } catch (paymentErr) {
          // CRITICAL — the booking IS created. Do NOT attempt a
          // compensating delete/cancel. Surface a distinct toast so
          // the operator records the payment from the booking details
          // screen rather than booking through the wizard again. Never
          // show the generic submit-error toast here.
          toast.error(
            t("bookings.wizard.step.confirm.paymentRecordFailed"),
            { id: "pos-payment-record-failed" },
          )
          console.error("[useBookingPosSubmit] collect payment failed", paymentErr)
        }
      }

      reset()
      onSuccess()
    } catch (err) {
      showApiError(err, { fallback: t("bookings.wizard.submitError"), t })
    }
  }, [
    state,
    useCredit,
    mainBranch,
    createMut,
    bookFromCreditMut,
    collectMut,
    paymentSettings,
    reset,
    onSuccess,
    t,
  ])

  return { submit, isSubmitting }
}