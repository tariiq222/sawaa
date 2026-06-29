'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ClientBookingItem } from '@sawaa/shared';
import { getMyBookingsApi } from '@/features/auth/auth.api';
import { initPayment } from '@/features/booking/booking.api';
import { paymentStatusKey, PAYMENT_STATUS_TOKEN, isInvoicePayable } from '@/features/account/status-labels';
import { AccountLoadError } from '@/features/account/load-error';
import { halalasToSar } from '@/lib/money';
import { t } from '@/features/locale/dictionary';
import { useT } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';
import { localizedName } from '@/features/locale/localized-name';
import { Calendar, Clock, MapPin, ChevronRight, CalendarPlus, CreditCard } from 'lucide-react';

interface ClientBookingsListProps {
  locale: Locale;
  initialBookings?: ClientBookingItem[];
  initialTotal?: number;
}

type Tab = 'upcoming' | 'past' | 'cancelled';

const TAB_KEYS = {
  upcoming: 'account.upcoming',
  past: 'account.past',
  cancelled: 'account.cancelled',
} as const;

function isCancelled(b: ClientBookingItem): boolean {
  return b.status === 'CANCELLED' || b.status === 'CANCEL_REQUESTED';
}

export function ClientBookingsList({ locale, initialBookings, initialTotal }: ClientBookingsListProps) {
  const router = useRouter();
  const tt = useT();
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  const hasInitial = !!initialBookings && initialBookings.length > 0;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['client', 'bookings'],
    queryFn: () => getMyBookingsApi(1, 50),
    initialData: hasInitial
      ? { items: initialBookings!, total: initialTotal ?? initialBookings!.length, page: 1, pageSize: 50 }
      : undefined,
  });

  const bookings = data?.items ?? [];
  const total = data?.total ?? 0;

  const now = new Date();
  const upcoming = bookings.filter((b) => !isCancelled(b) && new Date(b.scheduledAt) > now);
  const past = bookings.filter((b) => !isCancelled(b) && new Date(b.scheduledAt) <= now);
  const cancelled = bookings.filter(isCancelled);
  const byTab: Record<Tab, ClientBookingItem[]> = { upcoming, past, cancelled };
  const displayed = byTab[activeTab];

  if (isLoading && bookings.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-[var(--sw-neutral-100)] animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  // A failed fetch with no data to fall back on must surface a distinct error +
  // retry state, not the "book your first session" empty CTA.
  if (isError && bookings.length === 0) {
    return <AccountLoadError onRetry={() => void refetch()} />;
  }

  if (total === 0 && bookings.length === 0) {
    return <BookingsEmpty locale={locale} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className="flex gap-1 p-1 rounded-full self-start"
        style={{ background: 'var(--sw-neutral-100)' }}
        role="tablist"
      >
        {(['upcoming', 'past', 'cancelled'] as const).map((tab) => {
          const active = activeTab === tab;
          const count = byTab[tab].length;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                active
                  ? 'bg-[var(--sw-neutral-0)] text-[var(--sw-secondary-700)] shadow-[var(--sw-shadow-sm)]'
                  : 'text-[var(--sw-neutral-500)] hover:text-[var(--sw-secondary-700)]'
              }`}
            >
              {tt(TAB_KEYS[tab])}
              <span
                className={`text-xs font-bold px-1.5 rounded-full min-w-[1.25rem] text-center ${
                  active
                    ? 'bg-[color-mix(in_srgb,var(--sw-primary-500)_15%,transparent)] text-[var(--sw-primary-600)]'
                    : 'bg-[var(--sw-neutral-200)] text-[var(--sw-neutral-500)]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-10 text-sm text-[var(--sw-neutral-500)]">
          {tt('account.noBookings')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              locale={locale}
              onClick={() => router.push(`/account/bookings/${b.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingsEmpty({ locale }: { locale: Locale }) {
  const tt = useT();
  return (
    <div
      className="grid place-items-center text-center py-12 px-6 rounded-3xl"
      style={{
        background: 'color-mix(in srgb, var(--sw-primary-500) 4%, var(--sw-neutral-0))',
        border: '1px dashed color-mix(in srgb, var(--sw-primary-500) 25%, transparent)',
      }}
    >
      <div
        className="w-14 h-14 rounded-full grid place-items-center mb-4"
        style={{
          background: 'color-mix(in srgb, var(--sw-primary-500) 12%, transparent)',
          color: 'var(--sw-primary-600)',
        }}
        aria-hidden="true"
      >
        <CalendarPlus size={26} />
      </div>
      <h3 className="font-bold text-[var(--sw-secondary-700)] text-lg mb-1">
        {tt('account.empty.title')}
      </h3>
      <p className="text-sm text-[var(--sw-body)] max-w-xs leading-relaxed mb-5">
        {tt('account.empty.body')}
      </p>
      <Link
        href="/booking"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform"
      >
        {t(locale, 'account.empty.cta')}
        <ChevronRight size={14} className="rtl:rotate-180" aria-hidden="true" />
      </Link>
    </div>
  );
}

const STATUS_TOKEN: Record<string, string> = {
  PENDING: 'var(--warning)',
  PENDING_GROUP_FILL: 'var(--warning)',
  AWAITING_PAYMENT: 'var(--warning)',
  DEPOSIT_PAID: 'var(--sw-primary-600)',
  CONFIRMED: 'var(--success)',
  COMPLETED: 'var(--sw-primary-600)',
  CANCELLED: 'var(--error)',
  CANCEL_REQUESTED: 'var(--warning)',
  NO_SHOW: 'var(--error)',
  EXPIRED: 'var(--sw-neutral-400)',
};

function BookingCard({
  booking,
  locale,
  onClick,
}: {
  booking: ClientBookingItem;
  locale: Locale;
  onClick: () => void;
}) {
  const tt = useT();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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
  const statusColor = STATUS_TOKEN[booking.status] ?? 'var(--sw-neutral-400)';
  const serviceLabel = localizedName(locale, booking.serviceName, booking.serviceNameAr);
  const employeeLabel = localizedName(locale, booking.employeeName, booking.employeeNameAr);
  const branchLabel = localizedName(locale, booking.branchName, booking.branchNameAr);
  const payKey = paymentStatusKey(booking.paymentStatus);
  const payColor = PAYMENT_STATUS_TOKEN[booking.paymentStatus ?? 'UNKNOWN'] ?? 'var(--warning)';
  const payable = !!booking.invoiceId && isInvoicePayable(booking.invoiceStatus) && !isCancelled(booking);

  async function handlePayNow(e: React.MouseEvent) {
    e.stopPropagation();
    setPaying(true);
    setPayError(null);
    try {
      const { redirectUrl } = await initPayment(booking.invoiceId!);
      window.location.assign(redirectUrl);
    } catch {
      setPayError(tt('account.payError'));
      setPaying(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer text-start w-full p-5 rounded-2xl bg-[var(--sw-neutral-0)] border border-[var(--sw-neutral-100)] hover:border-[color-mix(in_srgb,var(--sw-primary-500)_30%,transparent)] hover:shadow-[var(--sw-shadow-md)] transition-all flex items-center gap-4"
    >
      <div
        className="hidden sm:flex shrink-0 w-14 h-14 rounded-2xl flex-col items-center justify-center"
        style={{
          background: 'color-mix(in srgb, var(--sw-primary-500) 8%, transparent)',
          color: 'var(--sw-primary-600)',
        }}
        aria-hidden="true"
      >
        <Calendar size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-[var(--sw-secondary-700)] truncate">
            {serviceLabel}
          </h3>
          <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
            <StatusPill color={statusColor} label={t(locale, statusKey as never) ?? booking.status} />
            <StatusPill color={payColor} label={tt(payKey)} />
          </div>
        </div>
        <p className="text-sm text-[var(--sw-body)] mt-1 truncate">
          {employeeLabel}
          {booking.branchName ? ` · ${branchLabel}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--sw-neutral-500)]">
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} aria-hidden="true" /> {dateStr}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={11} aria-hidden="true" /> {timeStr} · {booking.durationMins} {tt('booking.minutesShort')}
          </span>
          {booking.branchName && (
            <span className="inline-flex items-center gap-1 sm:hidden">
              <MapPin size={11} aria-hidden="true" /> {branchLabel}
            </span>
          )}
        </div>
        {payable && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePayNow}
              disabled={paying}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:translate-y-0"
            >
              <CreditCard size={12} aria-hidden="true" />
              {paying ? tt('account.paying') : tt('account.payNow')}
            </button>
            {payError && <span className="text-xs text-[var(--error)]">{payError}</span>}
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-sm font-bold text-[var(--sw-primary-600)]">
          {halalasToSar(Number(booking.price))} <span className="text-[var(--sw-neutral-500)] font-medium">{booking.currency}</span>
        </span>
        <ChevronRight
          size={16}
          className="text-[var(--sw-neutral-400)] rtl:rotate-180 group-hover:text-[var(--sw-primary-600)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-bold border whitespace-nowrap"
      style={{
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
