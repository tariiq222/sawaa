'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientBookingItem } from '@deqah/shared';
import { getMyBookingsApi } from '@/features/auth/auth.api';
import { t } from '@/features/locale/dictionary';
import type { Locale } from '@/features/locale/locale';

interface ClientBookingsListProps {
  locale: Locale;
  initialBookings?: ClientBookingItem[];
  initialTotal?: number;
}

export function ClientBookingsList({ locale, initialBookings = [], initialTotal = 0 }: ClientBookingsListProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings] = useState<ClientBookingItem[]>(initialBookings);
  const [total] = useState(initialTotal);

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.scheduledAt) > now);
  const past = bookings.filter((b) => new Date(b.scheduledAt) <= now);

  const displayed = activeTab === 'upcoming' ? upcoming : past;

  if (total === 0 && bookings.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.6 }}>
        {t(locale, 'account.noBookings')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)' }}>
        {(['upcoming', 'past'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--primary)' : 'var(--muted-foreground)',
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.9375rem',
              transition: 'all 0.2s',
            }}
          >
            {t(locale, `account.${tab}`)}
            <span
              style={{
                marginInlineStart: '0.5rem',
                background: 'var(--primary)',
                color: 'var(--on-primary)',
                borderRadius: '999px',
                padding: '0.1em 0.5em',
                fontSize: '0.75rem',
              }}
            >
              {tab === 'upcoming' ? upcoming.length : past.length}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {displayed.map((booking) => (
          <BookingCard key={booking.id} booking={booking} locale={locale} onClick={() => router.push(`/account/bookings/${booking.id}`)} />
        ))}
      </div>
    </div>
  );
}

function BookingCard({ booking, locale, onClick }: { booking: ClientBookingItem; locale: Locale; onClick: () => void }) {
  const scheduledAt = new Date(booking.scheduledAt);
  const dateStr = scheduledAt.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = scheduledAt.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusKey = `booking.status.${booking.status.toLowerCase()}`;
  const statusColor: Record<string, string> = {
    PENDING: 'var(--warning)',
    CONFIRMED: 'var(--success)',
    COMPLETED: 'var(--success)',
    CANCELLED: 'var(--error)',
    CANCEL_REQUESTED: 'var(--warning)',
  };

  return (
    <div
      onClick={onClick}
      style={{
        padding: '1.25rem',
        borderRadius: '12px',
        border: '1px solid color-mix(in srgb, var(--primary) 12%, transparent)',
        background: 'color-mix(in srgb, var(--surface) 60%, transparent)',
        backdropFilter: 'blur(12px)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--primary-dark)' }}>
          {booking.serviceName}
        </div>
        <div style={{ fontSize: '0.875rem', opacity: 0.75, marginBottom: '0.5rem' }}>
          {booking.employeeName}
          {booking.branchName && ` · ${booking.branchName}`}
        </div>
        <div style={{ fontSize: '0.8125rem', opacity: 0.7 }}>
          {dateStr} · {timeStr} · {booking.durationMins} min
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
        <span
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: `color-mix(in srgb, ${statusColor[booking.status] ?? 'var(--muted)'} 15%, transparent)`,
            color: statusColor[booking.status] ?? 'var(--muted-foreground)',
            border: `1px solid color-mix(in srgb, ${statusColor[booking.status] ?? 'var(--muted)'} 30%, transparent)`,
          }}
        >
          {t(locale, statusKey as never) ?? booking.status}
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>
          {booking.currency} {booking.price}
        </span>
      </div>
    </div>
  );
}
