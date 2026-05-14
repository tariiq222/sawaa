"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"

import type { Booking } from "@/lib/types/booking"
import { useBookingMutations } from "@/hooks/use-bookings"
import { useCreateBookingSlots } from "@/components/features/bookings/use-booking-slots"
import { useBookingEditDateReset } from "@/components/features/bookings/use-booking-form-resets"
import {
  rescheduleBookingSchema,
  type RescheduleBookingFormData,
} from "@/lib/schemas/booking.schema"
import { useLocale } from "@/components/locale-provider"

interface BookingRescheduleTabProps {
  booking: Booking
  onSuccess: () => void
}

export function BookingRescheduleTab({ booking, onSuccess }: BookingRescheduleTabProps) {
  const { t } = useLocale()
  const { rescheduleMut } = useBookingMutations()

  const form = useForm<RescheduleBookingFormData>({
    resolver: zodResolver(rescheduleBookingSchema),
    defaultValues: { date: booking.date, startTime: booking.startTime },
  })

  const watchedDate = form.watch("date")
  useBookingEditDateReset(form, watchedDate, booking.date)

  const { slots, slotsLoading, canFetchSlots } = useCreateBookingSlots({
    employeeId:   booking.employeeId,
    serviceId:        booking.serviceId,
    bookingType:      booking.type,
    date:             watchedDate,
    durationOptionId: "",
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await rescheduleMut.mutateAsync({ id: booking.id, date: data.date, startTime: data.startTime })
      toast.success(t("bookings.reschedule.toast.success"))
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bookings.reschedule.toast.error"))
    }
  })

  const slotPlaceholder = !watchedDate
    ? t("bookings.reschedule.slotPlaceholder.noDate")
    : slotsLoading
      ? t("bookings.reschedule.slotPlaceholder.loading")
      : t("bookings.reschedule.slotPlaceholder.pick")

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 pt-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-foreground">{t("bookings.reschedule.dateLabel")}</Label>
          <Controller control={form.control} name="date" render={({ field }) => (
            <DatePicker value={field.value} onChange={field.onChange} placeholder={t("bookings.reschedule.datePlaceholder")} className="w-full bg-surface-muted" />
          )} />
          {form.formState.errors.date && (
            <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-foreground">{t("bookings.reschedule.timeLabel")}</Label>
          <Controller control={form.control} name="startTime" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={!canFetchSlots}>
              <SelectTrigger className="w-full h-10 bg-surface-muted border-border">
                <SelectValue placeholder={slotPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {slots.length === 0 && !slotsLoading && (
                  <SelectItem value="__empty__" disabled>{t("bookings.reschedule.noSlots")}</SelectItem>
                )}
                {slots.map((slot) => (
                  <SelectItem key={slot.startTime} value={slot.startTime} className="font-numeric">
                    {slot.startTime} – {slot.endTime}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
          {form.formState.errors.startTime && (
            <p className="text-xs text-destructive">{form.formState.errors.startTime.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-start">
        <Button type="submit" disabled={form.formState.isSubmitting} className="px-6">
          {form.formState.isSubmitting ? t("bookings.reschedule.submitting") : t("bookings.reschedule.submit")}
        </Button>
      </div>
    </form>
  )
}
