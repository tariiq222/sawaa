'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Locale } from '@/features/locale/locale';
import { localizedName } from '@/features/locale/localized-name';
import { halalasToSar } from '@/lib/money';
import { t } from '@/features/locale/dictionary';
import { useT } from '@/features/locale/locale-provider';
import { useCurrentClient } from '@/features/auth/public';
import { IntakeFormsSection } from '@/features/intake/intake-forms-section';
import { AccountLoadError } from './load-error';
import type { ClientBookingItem } from '@sawaa/shared';
import {
  getMyBookingApi,
  cancelMyBookingApi,
  rescheduleMyBookingApi,
} from '@/features/auth/auth.api';
import { initPayment } from '@/features/booking/booking.api';
import {
  paymentStatusKey,
  PAYMENT_STATUS_TOKEN,
  isInvoicePayable,
} from './status-labels';
import {
  Calendar,
  Clock,
  User as UserIcon,
  MapPin,
  Receipt,
  CreditCard,
  ArrowRight,
  AlertTriangle,
  Video,
} from 'lucide-react';

function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface BookingDetailFeatureProps {
  bookingId: string;
  locale: Locale;
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

const INPUT =
  'w-full py-3 px-4 rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] text-base text-[var(--sw-secondary-700)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--sw-primary-500)] focus:bg-[var(--sw-neutral-0)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sw-primary-500)_15%,transparent)]';

export function BookingDetailFeature({ bookingId, locale }: BookingDetailFeatureProps) {
  const { client } = useCurrentClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tt = useT();
  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // Local override so the UI reflects a cancellation immediately, without
  // waiting for the booking query to refetch.
  const [cancelledStatus, setCancelledStatus] = useState<'CANCELLED' | 'CANCEL_REQUESTED' | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  const { data: booking, isLoading, isError, refetch } = useQuery({
    queryKey: ['client', 'bookings', 'detail', bookingId],
    queryFn: () => getMyBookingApi(bookingId),
    enabled: !!client && !!bookingId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-32 rounded-2xl bg-[var(--sw-neutral-100)] animate-pulse" aria-hidden="true" />
        <div className="h-44 rounded-2xl bg-[var(--sw-neutral-100)] animate-pulse" aria-hidden="true" />
      </div>
    );
  }
  // A thrown error (expired session, 500, network) gets a distinct error +
  // retry state; the notFound copy is reserved for an actual 404 / empty
  // success where the query resolved with no booking.
  if (isError) {
    return <AccountLoadError onRetry={() => void refetch()} />;
  }
  if (!booking) {
    return (
      <div className="grid place-items-center py-16 text-sm text-[var(--sw-neutral-500)]">
        {tt('booking.notFound')}
      </div>
    );
  }

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
  const displayStatus = cancelledStatus ?? booking.status;
  const statusKey = `booking.status.${displayStatus.toLowerCase()}`;
  const statusColor = STATUS_TOKEN[displayStatus] ?? 'var(--sw-neutral-400)';
  const serviceLabel = localizedName(locale, booking.serviceName, booking.serviceNameAr);
  const employeeLabel = localizedName(locale, booking.employeeName, booking.employeeNameAr);
  const branchLabel = localizedName(locale, booking.branchName, booking.branchNameAr);
  const canAct = displayStatus === 'PENDING' || displayStatus === 'CONFIRMED';
  // The booking-detail payload may carry context IDs even though the shared
  // ClientBookingItem type does not declare them yet. Read them defensively;
  // IntakeFormsSection stays inert when serviceId is absent.
  const ctx = booking as ClientBookingItem & {
    serviceId?: string | null;
    employeeId?: string | null;
    branchId?: string | null;
  };

  const payPillKey = paymentStatusKey(booking.paymentStatus);
  const payPillColor = PAYMENT_STATUS_TOKEN[booking.paymentStatus ?? 'UNKNOWN'] ?? 'var(--warning)';
  const payable = !!booking.invoiceId && isInvoicePayable(booking.invoiceStatus);
  const canJoin =
    booking.deliveryType === 'ONLINE' && !!booking.zoomJoinUrl && booking.status === 'CONFIRMED';

  async function handlePayNow() {
    if (!booking?.invoiceId) return;
    setPaying(true);
    setPayError(null);
    try {
      const { redirectUrl } = await initPayment(booking.invoiceId);
      window.location.assign(redirectUrl);
    } catch {
      setPayError(tt('account.payError'));
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/account/bookings"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--sw-primary-600)] hover:underline self-start"
      >
        <ArrowRight size={14} className="rtl:rotate-0 rotate-180" aria-hidden="true" />
        {tt('account.bookings')}
      </Link>

      <header
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--sw-primary-500) 10%, var(--sw-neutral-0)) 0%, var(--sw-neutral-0) 70%)',
          border: '1px solid color-mix(in srgb, var(--sw-primary-500) 12%, transparent)',
          boxShadow: 'var(--sw-shadow-md)',
        }}
      >
        <div
          className="absolute -top-16 -end-16 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 10%, transparent)' }}
          aria-hidden="true"
        />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-[var(--sw-body)] mb-1">
              {tt('booking.summary.service')}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--sw-secondary-700)] leading-tight">
              {serviceLabel}
            </h1>
            <p className="text-sm text-[var(--sw-body)] mt-2">{employeeLabel}</p>
          </div>
          <StatusPill color={statusColor} label={t(locale, statusKey as never) ?? displayStatus} />
        </div>
      </header>

      {cancelNotice && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl text-sm font-semibold bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] text-[var(--success)]"
        >
          {cancelNotice}
        </div>
      )}

      <section className="grid sm:grid-cols-2 gap-3">
        <DetailTile icon={<Calendar size={16} />} label={tt('booking.detail.date')} value={dateStr} />
        <DetailTile
          icon={<Clock size={16} />}
          label={tt('booking.detail.time')}
          value={`${timeStr} · ${booking.durationMins} ${tt('booking.minutesShort')}`}
        />
        <DetailTile icon={<UserIcon size={16} />} label={tt('booking.detail.therapist')} value={employeeLabel} />
        {booking.branchName && (
          <DetailTile icon={<MapPin size={16} />} label={tt('booking.detail.branch')} value={branchLabel} />
        )}
      </section>

      <section
        className="rounded-2xl p-5 sm:p-6 bg-[var(--sw-neutral-0)] border border-[var(--sw-neutral-100)]"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-[var(--sw-secondary-700)] inline-flex items-center gap-2">
            <Receipt size={16} aria-hidden="true" /> {tt('booking.detail.invoice')}
          </h2>
          <Link
            href={`/account/bookings/${booking.id}/invoice`}
            className="text-sm font-semibold text-[var(--sw-primary-600)] hover:underline inline-flex items-center gap-1"
          >
            {tt('booking.detail.viewInvoice')}
            <ArrowRight size={12} className="rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
        <div className="flex justify-between items-center text-sm gap-2 flex-wrap">
          <span className="text-[var(--sw-body)] inline-flex items-center gap-2">
            <CreditCard size={14} aria-hidden="true" />
            {tt('booking.detail.payment')}:
            <StatusPill color={payPillColor} label={tt(payPillKey)} />
          </span>
          <span className="font-bold text-[var(--sw-secondary-700)] text-lg">
            {halalasToSar(Number(booking.price))}{' '}
            <span className="text-sm font-medium text-[var(--sw-neutral-500)]">{booking.currency}</span>
          </span>
        </div>
        {(payable || canJoin) && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {payable && (
              <button
                type="button"
                onClick={handlePayNow}
                disabled={paying}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:translate-y-0"
              >
                <CreditCard size={14} aria-hidden="true" />
                {paying ? tt('account.paying') : tt('account.payNow')}
              </button>
            )}
            {canJoin && (
              <a
                href={booking.zoomJoinUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold border border-[color-mix(in_srgb,var(--sw-primary-500)_40%,transparent)] text-[var(--sw-primary-600)] hover:bg-[color-mix(in_srgb,var(--sw-primary-500)_6%,transparent)] transition-colors"
              >
                <Video size={14} aria-hidden="true" />
                {tt('account.joinSession')}
              </a>
            )}
          </div>
        )}
        {payError && (
          <div className="mt-3 px-3 py-2 rounded-lg text-sm bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]">
            {payError}
          </div>
        )}
      </section>

      <IntakeFormsSection
        bookingId={booking.id}
        serviceId={ctx.serviceId}
        employeeId={ctx.employeeId}
        branchId={ctx.branchId}
        enabled={canAct}
      />

      {canAct && (
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            onClick={() => setShowCancel(true)}
            className="flex-1 px-5 py-3 rounded-full font-bold text-sm border bg-[var(--sw-neutral-0)] text-[var(--error)] border-[color-mix(in_srgb,var(--error)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--error)_6%,transparent)] transition-colors"
          >
            {t(locale, 'booking.cancel')}
          </button>
          <button
            onClick={() => setShowReschedule(true)}
            className="flex-1 px-5 py-3 rounded-full font-bold text-sm bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform"
          >
            {t(locale, 'booking.reschedule')}
          </button>
        </div>
      )}

      {showCancel && (
        <CancelModal
          locale={locale}
          onClose={() => setShowCancel(false)}
          onSuccess={(status) => {
            setShowCancel(false);
            setCancelledStatus(status);
            setCancelNotice(
              status === 'CANCELLED' ? tt('booking.cancelSuccess') : tt('booking.cancelPending'),
            );
            // Refresh cached bookings (list + detail) so the new status persists.
            void queryClient.invalidateQueries({ queryKey: ['client', 'bookings'] });
          }}
          cancelApi={(reason) => cancelMyBookingApi(bookingId, reason)}
        />
      )}

      {showReschedule && (
        <RescheduleModal
          booking={booking}
          locale={locale}
          onClose={() => setShowReschedule(false)}
          onSuccess={() => {
            setShowReschedule(false);
            router.refresh();
          }}
          rescheduleApi={(newScheduledAt) => rescheduleMyBookingApi(bookingId, newScheduledAt)}
        />
      )}
    </div>
  );
}

function DetailTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--sw-neutral-0)] border border-[var(--sw-neutral-100)]">
      <span className="shrink-0 w-9 h-9 rounded-full grid place-items-center bg-[color-mix(in_srgb,var(--sw-primary-500)_10%,transparent)] text-[var(--sw-primary-600)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--sw-neutral-500)] mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-[var(--sw-secondary-700)]">{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
      style={{
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,46,63,0.5)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--sw-neutral-0)] rounded-3xl p-6 sm:p-7 w-full max-w-[420px] flex flex-col gap-5 shadow-[var(--sw-shadow-2xl)]"
      >
        {children}
      </div>
    </div>
  );
}

function CancelModal({
  locale,
  onClose,
  onSuccess,
  cancelApi,
}: {
  locale: Locale;
  onClose: () => void;
  onSuccess: (status: 'CANCELLED' | 'CANCEL_REQUESTED') => void;
  cancelApi: (reason?: string) => Promise<{ status: string; requiresApproval: boolean }>;
}) {
  const tt = useT();
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await cancelApi(reason || undefined);
      onSuccess(result.status === 'CANCELLED' ? 'CANCELLED' : 'CANCEL_REQUESTED');
    } catch {
      setError(tt('booking.cancelFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-10 h-10 rounded-full grid place-items-center bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]">
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-bold text-[var(--sw-secondary-700)] text-lg">
            {t(locale, 'booking.cancel')}
          </h3>
          <p className="text-sm text-[var(--sw-body)] mt-1 leading-relaxed">
            {t(locale, 'booking.cancelConfirm')}
          </p>
        </div>
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder=" "
        className={`${INPUT} resize-none`}
      />

      {error && (
        <div className="px-3 py-2 rounded-lg text-sm bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 rounded-full font-semibold text-sm bg-[var(--sw-neutral-100)] text-[var(--sw-secondary-700)] hover:bg-[var(--sw-neutral-200)] transition-colors disabled:opacity-60"
        >
          {tt('booking.keep')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 rounded-full font-bold text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-60"
          style={{ background: 'var(--error)' }}
        >
          {isLoading ? tt('booking.detail.cancelling') : tt('booking.confirmCancel')}
        </button>
      </div>
    </ModalShell>
  );
}

function RescheduleModal({
  booking,
  locale,
  onClose,
  onSuccess,
  rescheduleApi,
}: {
  booking: ClientBookingItem;
  locale: Locale;
  onClose: () => void;
  onSuccess: () => void;
  rescheduleApi: (newScheduledAt: string) => Promise<{ booking: unknown }>;
}) {
  const tt = useT();
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!newDate || !newTime) return;
    setIsLoading(true);
    setError(null);
    try {
      await rescheduleApi(new Date(`${newDate}T${newTime}`).toISOString());
      onSuccess();
    } catch {
      setError(tt('booking.rescheduleFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div>
        <h3 className="font-bold text-[var(--sw-secondary-700)] text-lg">
          {t(locale, 'booking.reschedule')}
        </h3>
        <p className="text-sm text-[var(--sw-body)] mt-1 leading-relaxed">
          {tt('booking.reschedulePrompt')}{' '}
          <span className="font-semibold">
            {localizedName(locale, booking.serviceName, booking.serviceNameAr)}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--sw-secondary-700)] mb-1.5">
            {tt('booking.detail.newDate')}
          </label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={todayLocalIso()}
            className={INPUT}
            suppressHydrationWarning
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--sw-secondary-700)] mb-1.5">
            {tt('booking.detail.newTime')}
          </label>
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-sm bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 rounded-full font-semibold text-sm bg-[var(--sw-neutral-100)] text-[var(--sw-secondary-700)] hover:bg-[var(--sw-neutral-200)] transition-colors disabled:opacity-60"
        >
          {tt('booking.back')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={isLoading || !newDate || !newTime}
          className="flex-1 px-4 py-2.5 rounded-full font-bold text-sm bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:translate-y-0"
        >
          {isLoading ? tt('booking.detail.rescheduling') : tt('booking.detail.confirm')}
        </button>
      </div>
    </ModalShell>
  );
}
