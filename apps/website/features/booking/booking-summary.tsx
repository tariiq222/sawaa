'use client';

import type { Service, EmployeeWithUser, AvailableSlot } from '@sawaa/shared';
import { halalasToSarNumber } from '@/lib/money';
import { useT } from '@/features/locale/locale-provider';

interface BookingSummaryProps {
  service: Service;
  employee: EmployeeWithUser;
  slot: AvailableSlot;
  totalHalalat: number;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function BookingSummary({
  service,
  employee,
  slot,
  totalHalalat,
  onConfirm,
  isSubmitting,
}: BookingSummaryProps) {
  const t = useT();
  const start = new Date(slot.startTime);
  const dateStr = start.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = start.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t('booking.summary.title')}</h2>
      <div className="p-4 border border-[color-mix(in_srgb,var(--primary)_15%,transparent)] rounded-[var(--radius)]">
        <div className="grid gap-3">
          <div>
            <div className="text-xs opacity-60">{t('booking.summary.service')}</div>
            <div className="font-medium">{service.nameAr}</div>
          </div>
          <div>
            <div className="text-xs opacity-60">{t('booking.summary.therapist')}</div>
            <div className="font-medium">{employee.user.firstName} {employee.user.lastName}</div>
          </div>
          <div>
            <div className="text-xs opacity-60">{t('booking.summary.dateTime')}</div>
            <div className="font-medium">{dateStr} · {timeStr}</div>
          </div>
          <div>
            <div className="text-xs opacity-60">{t('booking.summary.total')}</div>
            <div className="font-bold text-lg">
              {Intl.NumberFormat('ar-SA', { style: 'decimal' }).format(halalasToSarNumber(totalHalalat))} {'⃁'}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onConfirm}
        disabled={isSubmitting}
        className="p-3.5 font-semibold cursor-pointer rounded-[var(--radius)] bg-[var(--primary)] text-white border-none disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? t('booking.processing') : t('booking.confirmAndPay')}
      </button>
    </div>
  );
}
