"use client"

// EXCEPTION: hook size limit (200) exceeded — 2026-08-23 — Phase 6
// extracted the booking-pos `handleSubmit` (with its track-aware
// GROUP guard and the useCredit / paid branches) into a custom hook
// so `booking-pos.tsx` stays under the 350-line absolute limit.
//
// W2-T2 update — 2026-08-23 — added the W2-T2 "collect-now" sequence:
// after a successful createMut on the PAID branch, when the operator
// picked "تحصيل الآن" (payAtClinic === false), the hook now calls
// ensureBookingInvoice and recordPayment on the booking just created.
// CRITICAL: those two calls are a separate server round-trip pair with
// no transaction spanning createBooking + ensure/record, so a failure
// on either step leaves the booking CREATED. The wizard must still
// close successfully and surface a distinct Arabic toast — never a
// compensating delete/cancel of a real booking. The credit branch
// above is intentionally left untouched and is the financial-surface
// sacred ground mentioned by the user ("انتبه التعديل. ياثر علي
// العمليات الموجوده لان فيه بيانات ما نبيها تكسر").

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
import {
  resolveActiveMethod,
  type PayMethod,
} from "@/components/features/shared/payment-method-picker"

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
  // W2-T2 — the "collect-now" sequence reuses the same mutations the
  // existing record-payment dialog uses. We deliberately do NOT
  // introduce a second payment-recording code path.
  const { recordMut, ensureInvoiceMut } = useRecordPaymentMutations()
  const { data: paymentSettings } = usePaymentSettings()

  const isSubmitting =
    createMut.isPending ||
    bookFromCreditMut.isPending ||
    recordMut.isPending ||
    ensureInvoiceMut.isPending

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
    // W2-T2 — the credit branch remains COMPLETELY UNTOUCHED: it must
    // still post to /from-credit, still send no payAtClinic, and must
    // never call ensureInvoice or recordPayment — package-credit
    // bookings are zero-priced and pre-paid.
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

      // W2-T2 — only the PAID branch AND only when the operator picked
      // "تحصيل الآن" (payAtClinic === false) do we record a payment.
      // The credit branch above already returned; nothing below this
      // line touches it.
      if (created && !state.payAtClinic) {
        try {
          const invoice = await ensureInvoiceMut.mutateAsync(created.id)
          // Backend truth: `outstanding` is integer halalas, already
          // includes VAT and any coupon discount. We deliberately do
          // NOT compute the amount from the wizard's servicePrice or
          // do any client-side arithmetic on the submission path.
          const amount = invoice.outstanding
          if (amount > 0) {
            const method: PayMethod = resolveActiveMethod(
              paymentSettings,
              state.collectionMethod,
            )
            await recordMut.mutateAsync({
              invoiceId: invoice.id,
              amount,
              method,
            })
            toast.success(t("bookings.wizard.step.confirm.paymentRecorded"))
          }
          // If outstanding <= 0 the booking is already paid (e.g. a
          // 100%-discount or coupon edge case). The booking is
          // legitimately created; close the wizard.
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
          console.error("[useBookingPosSubmit] payment recording failed", paymentErr)
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
    ensureInvoiceMut,
    recordMut,
    paymentSettings,
    reset,
    onSuccess,
    t,
  ])

  return { submit, isSubmitting }
}