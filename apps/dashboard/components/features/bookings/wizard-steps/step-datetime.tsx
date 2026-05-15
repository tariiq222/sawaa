import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useLocale } from '@/components/locale-provider'
import { useCreateBookingSlots } from '../use-booking-slots'

/** Format date as YYYY-MM-DD using LOCAL time (not UTC) to avoid date shift near midnight. */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function generateDays(count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })
}

interface StepDatetimeProps {
  employeeId: string
  serviceId: string
  bookingType: string
  durationOptionId: string | null
  selectedDate: string | null
  selectedTime: string | null
  onSelectDate: (date: string) => void
  onSelectTime: (startTime: string) => void
  maxAdvanceDays?: number
}

export function StepDatetime({
  employeeId,
  serviceId,
  bookingType,
  durationOptionId,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  maxAdvanceDays = 90,
}: StepDatetimeProps) {
  const { t } = useLocale()

  const days = useMemo(() => generateDays(Math.min(maxAdvanceDays, 90)), [maxAdvanceDays])

  const { slots = [], slotsLoading } = useCreateBookingSlots({
    employeeId,
    serviceId,
    bookingType,
    date: selectedDate ?? '',
    durationOptionId: durationOptionId ?? '',
  })

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('bookings.wizard.step.datetime.dayTitle')}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {days.map((day) => {
            const iso = toISODate(day)
            const isSelected = iso === selectedDate
            const weekday = day.toLocaleDateString('ar-SA', { weekday: 'short' })
            const dayNum = day.toLocaleDateString('ar-SA', { day: 'numeric' })
            const monthName = day.toLocaleDateString('ar-SA', { month: 'short' })
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelectDate(iso)}
                className={cn(
                  'flex min-w-[88px] flex-col items-center gap-1 rounded-xl border border-border bg-surface px-3 py-4',
                  'text-center transition-all duration-150',
                  'hover:border-primary/60 hover:bg-primary/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  isSelected && 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm',
                )}
              >
                <span className="text-xs text-muted-foreground">{weekday}</span>
                <span className={cn('text-sm font-bold', isSelected && 'text-primary')}>{dayNum}</span>
                <span className="text-xs text-muted-foreground">{monthName}</span>
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('bookings.wizard.step.datetime.timeTitle')}
          </p>

          {slotsLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('bookings.wizard.step.datetime.noSlots')}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() => onSelectTime(slot.startTime)}
                  className={cn(
                    'rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-all duration-150',
                    'hover:border-primary/60 hover:bg-primary/5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    selectedTime === slot.startTime && 'border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary/20',
                  )}
                >
                  {slot.startTime}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}