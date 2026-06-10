'use client';

import { useQuery } from '@tanstack/react-query';
import type { ClientBookingItem } from '@sawaa/shared';
import { getMyBookingsApi } from '@/features/auth/auth.api';
import { getMyInvoicesApi } from './account.api';
import { useT } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';
import { halalasToSar } from '@/lib/money';
import { isInvoicePayable } from './status-labels';
import { Calendar, Clock, User as UserIcon, Video, AlertCircle, ArrowRight, CalendarCheck, CalendarRange, Wallet } from 'lucide-react';

interface OverviewTabProps {
  locale: Locale;
  onGoToInvoices: () => void;
}

export function OverviewTab({ locale, onGoToInvoices }: OverviewTabProps) {
  const tt = useT();

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['client', 'bookings'],
    queryFn: () => getMyBookingsApi(1, 50),
  });
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['client', 'invoices'],
    queryFn: () => getMyInvoicesApi(),
  });

  if (bookingsLoading || invoicesLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-[var(--sw-neutral-100)] animate-pulse" aria-hidden="true" />
        ))}
      </div>
    );
  }

  const bookings = bookingsData?.items ?? [];
  const invoices = invoicesData?.items ?? [];
  const now = new Date();

  const upcoming = bookings
    .filter((b) => new Date(b.scheduledAt) > now && b.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const next = upcoming[0] ?? null;

  const unpaidInvoices = invoices.filter((inv) => isInvoicePayable(inv.status));
  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const currency = unpaidInvoices[0]?.currency ?? invoices[0]?.currency ?? 'SAR';

  return (
    <div className="flex flex-col gap-6">
      {unpaidInvoices.length > 0 && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm"
          style={{
            background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
            color: 'var(--warning)',
          }}
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            <AlertCircle size={16} aria-hidden="true" />
            {tt('account.overview.unpaidAlert')}
          </span>
          <button
            type="button"
            onClick={onGoToInvoices}
            className="inline-flex items-center gap-1 font-bold hover:underline shrink-0"
          >
            {tt('account.overview.goToInvoices')}
            <ArrowRight size={13} className="rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      )}

      <section
        className="rounded-3xl p-5 sm:p-6"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--sw-primary-500) 8%, var(--sw-neutral-0)) 0%, var(--sw-neutral-0) 70%)',
          border: '1px solid color-mix(in srgb, var(--sw-primary-500) 12%, transparent)',
        }}
      >
        <h2 className="text-sm font-bold text-[var(--sw-neutral-500)] mb-3">
          {tt('account.overview.nextSession')}
        </h2>
        {next ? <NextBookingCard booking={next} locale={locale} /> : (
          <p className="text-sm text-[var(--sw-body)]">{tt('account.overview.noUpcoming')}</p>
        )}
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <StatTile
          icon={<CalendarCheck size={16} aria-hidden="true" />}
          label={tt('account.overview.upcomingCount')}
          value={String(upcoming.length)}
        />
        <StatTile
          icon={<CalendarRange size={16} aria-hidden="true" />}
          label={tt('account.overview.totalCount')}
          value={String(bookingsData?.total ?? bookings.length)}
        />
        <StatTile
          icon={<Wallet size={16} aria-hidden="true" />}
          label={tt('account.overview.unpaidTotal')}
          value={`${halalasToSar(unpaidTotal)} ${currency}`}
          tone={unpaidTotal > 0 ? 'warning' : undefined}
        />
      </section>
    </div>
  );
}

function NextBookingCard({ booking, locale }: { booking: ClientBookingItem; locale: Locale }) {
  const tt = useT();
  const scheduledAt = new Date(booking.scheduledAt);
  const dateStr = scheduledAt.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = scheduledAt.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const canJoin =
    booking.deliveryType === 'ONLINE' && !!booking.zoomJoinUrl && booking.status === 'CONFIRMED';

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold text-[var(--sw-secondary-700)] text-lg">{booking.serviceName}</h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--sw-body)]">
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={13} aria-hidden="true" /> {dateStr}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={13} aria-hidden="true" /> {timeStr}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserIcon size={13} aria-hidden="true" /> {booking.employeeName}
        </span>
      </div>
      {canJoin && (
        <a
          href={booking.zoomJoinUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform"
        >
          <Video size={15} aria-hidden="true" />
          {tt('account.joinSession')}
        </a>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'warning';
}) {
  const color = tone === 'warning' ? 'var(--warning)' : 'var(--sw-primary-600)';
  return (
    <div className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-[var(--sw-neutral-0)] border border-[var(--sw-neutral-100)]">
      <span
        className="shrink-0 w-9 h-9 rounded-full grid place-items-center"
        style={{
          background: `color-mix(in srgb, ${color} 10%, transparent)`,
          color,
        }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--sw-neutral-500)]">{label}</p>
        <p className="text-lg font-extrabold text-[var(--sw-secondary-700)]">{value}</p>
      </div>
    </div>
  );
}
