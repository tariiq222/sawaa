'use client';

import type { GuestClientInfo, Service, EmployeeWithUser, AvailableSlot } from '@deqah/shared';
import { halalasToSarNumber } from '@/lib/money';

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
  const start = new Date(slot.startTime);
  const dateStr = start.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = start.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Booking Summary</h2>
      <div style={{ padding: '1rem', border: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Service</div>
            <div style={{ fontWeight: 500 }}>{service.nameAr}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Therapist</div>
            <div style={{ fontWeight: 500 }}>{employee.user.firstName} {employee.user.lastName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Date & Time</div>
            <div style={{ fontWeight: 500 }}>{dateStr} · {timeStr}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Total</div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>
              {Intl.NumberFormat('ar-SA', { style: 'decimal' }).format(halalasToSarNumber(totalHalalat))} {'⃁'}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onConfirm}
        disabled={isSubmitting}
        style={{
          padding: '0.875rem',
          background: 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius)',
          fontWeight: 600,
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          opacity: isSubmitting ? 0.6 : 1,
        }}
      >
        {isSubmitting ? 'Processing...' : 'Confirm & Pay'}
      </button>
    </div>
  );
}