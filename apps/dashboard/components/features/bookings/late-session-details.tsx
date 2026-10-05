'use client'
import { useLocale } from '@/components/locale-provider'
import type { Booking } from '@/lib/types/booking'
export function LateSessionDetails({ booking }: { booking: Booking }) {
  const { t, locale } = useLocale()
  if (!booking.isLateEntry) return null
  const format = (date: string) => new Date(date).toLocaleString(locale, { timeZone: 'Asia/Riyadh' })
  return <div className="rounded-xl border border-border bg-surface p-4 text-sm">
    <p className="font-semibold">{t('bookings.late.title')}</p>
    {booking.lateEntryRecordedAt && <p>{t('bookings.late.recordedAt')}: {format(booking.lateEntryRecordedAt)}</p>}
    <p>{t('bookings.late.recordedBy')}: {booking.lateEntryRecordedByName ?? booking.lateEntryRecordedBy ?? '—'}</p>
    {booking.payment?.effectiveReceivedAt && <><p>{t('bookings.late.receivedAt')}: {format(booking.payment.effectiveReceivedAt)}</p>{booking.payment.createdAt && <p>{t('bookings.late.receiptRecordedAt')}: {format(booking.payment.createdAt)}</p>}</>}
  </div>
}
