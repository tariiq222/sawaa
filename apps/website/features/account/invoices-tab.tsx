'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ClientInvoiceItem } from '@sawaa/shared';
import { getMyInvoicesApi, requestRefundApi } from './account.api';
import { initPayment } from '@/features/booking/booking.api';
import { useT } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';
import { halalasToSar } from '@/lib/money';
import { invoiceStatusKey, INVOICE_STATUS_TOKEN, isInvoicePayable } from './status-labels';
import { AccountLoadError } from './load-error';
import { Receipt, Calendar, ArrowRight, CreditCard, RotateCcw } from 'lucide-react';

interface InvoicesTabProps {
  locale: Locale;
}

export function InvoicesTab({ locale }: InvoicesTabProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['client', 'invoices'],
    queryFn: () => getMyInvoicesApi(),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-[var(--sw-neutral-100)] animate-pulse" aria-hidden="true" />
        ))}
      </div>
    );
  }

  // A failed/expired fetch must surface a distinct error + retry state instead
  // of collapsing into the "you have nothing" empty state.
  if (isError) {
    return <AccountLoadError onRetry={() => void refetch()} />;
  }

  const invoices = data?.items ?? [];

  if (invoices.length === 0) {
    return <InvoicesEmpty />;
  }

  return (
    <div className="flex flex-col gap-3">
      {invoices.map((inv) => (
        <InvoiceCard key={inv.id} invoice={inv} locale={locale} />
      ))}
    </div>
  );
}

function InvoicesEmpty() {
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
        <Receipt size={26} />
      </div>
      <h3 className="font-bold text-[var(--sw-secondary-700)] text-lg mb-1">
        {tt('account.invoices.empty.title')}
      </h3>
      <p className="text-sm text-[var(--sw-body)] max-w-xs leading-relaxed">
        {tt('account.invoices.empty.body')}
      </p>
    </div>
  );
}

function InvoiceCard({ invoice, locale }: { invoice: ClientInvoiceItem; locale: Locale }) {
  const tt = useT();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundSending, setRefundSending] = useState(false);
  const [refundMessage, setRefundMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const statusKey = invoiceStatusKey(invoice.status);
  const statusColor = INVOICE_STATUS_TOKEN[invoice.status] ?? 'var(--sw-neutral-400)';
  const payable = isInvoicePayable(invoice.status);
  const refundable = invoice.status === 'PAID';

  const dateStr = invoice.scheduledAt
    ? new Date(invoice.scheduledAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  async function handlePayNow() {
    setPaying(true);
    setPayError(null);
    try {
      const { redirectUrl } = await initPayment(invoice.id);
      window.location.assign(redirectUrl);
    } catch {
      setPayError(tt('account.payError'));
      setPaying(false);
    }
  }

  async function handleRefundSubmit() {
    setRefundSending(true);
    setRefundMessage(null);
    try {
      await requestRefundApi(invoice.id, refundReason.trim() || undefined);
      setRefundMessage({ ok: true, text: tt('account.invoices.refundSuccess') });
      setShowRefund(false);
    } catch (err) {
      const backendMessage =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : null;
      setRefundMessage({ ok: false, text: backendMessage || tt('account.invoices.refundError') });
    } finally {
      setRefundSending(false);
    }
  }

  return (
    <div className="p-5 rounded-2xl bg-[var(--sw-neutral-0)] border border-[var(--sw-neutral-100)] flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[var(--sw-neutral-500)] mb-0.5">
            {tt('account.invoices.number')} #{invoice.number}
          </p>
          <h3 className="font-bold text-[var(--sw-secondary-700)] truncate">{invoice.serviceName}</h3>
        </div>
        <StatusPill
          color={statusColor}
          label={statusKey ? tt(statusKey) : invoice.status}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--sw-neutral-500)]">
          {dateStr && (
            <>
              <Calendar size={11} aria-hidden="true" /> {dateStr}
            </>
          )}
        </span>
        <span className="font-bold text-[var(--sw-secondary-700)]">
          {halalasToSar(invoice.total)}{' '}
          <span className="text-xs font-medium text-[var(--sw-neutral-500)]">{invoice.currency}</span>
        </span>
      </div>

      {invoice.refundedAmount > 0 && (
        <p className="text-xs text-[var(--sw-neutral-500)]">
          {tt('account.invoices.refundedAmount')}: {halalasToSar(invoice.refundedAmount)} {invoice.currency}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {invoice.bookingId && (
          <Link
            href={`/account/bookings/${invoice.bookingId}/invoice`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-[var(--sw-neutral-200)] text-[var(--sw-secondary-700)] hover:border-[color-mix(in_srgb,var(--sw-primary-500)_40%,transparent)] transition-colors"
          >
            {tt('account.invoices.view')}
            <ArrowRight size={12} className="rtl:rotate-180" aria-hidden="true" />
          </Link>
        )}
        {payable && (
          <button
            type="button"
            onClick={handlePayNow}
            disabled={paying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:translate-y-0"
          >
            <CreditCard size={12} aria-hidden="true" />
            {paying ? tt('account.paying') : tt('account.payNow')}
          </button>
        )}
        {refundable && (
          <button
            type="button"
            onClick={() => setShowRefund((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border bg-[var(--sw-neutral-0)] text-[var(--error)] border-[color-mix(in_srgb,var(--error)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--error)_6%,transparent)] transition-colors"
          >
            <RotateCcw size={12} aria-hidden="true" />
            {tt('account.invoices.requestRefund')}
          </button>
        )}
      </div>

      {payError && (
        <div className="px-3 py-2 rounded-lg text-sm bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]">
          {payError}
        </div>
      )}

      {showRefund && (
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-[var(--sw-neutral-50)] border border-[var(--sw-neutral-100)]">
          <label
            htmlFor={`refund-reason-${invoice.id}`}
            className="text-sm font-medium text-[var(--sw-secondary-700)]"
          >
            {tt('account.invoices.refundReason')}
          </label>
          <textarea
            id={`refund-reason-${invoice.id}`}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={2}
            className="w-full py-2.5 px-3 rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-0)] text-sm text-[var(--sw-secondary-700)] outline-none resize-none focus:border-[var(--sw-primary-500)]"
          />
          <button
            type="button"
            onClick={handleRefundSubmit}
            disabled={refundSending}
            className="self-start px-4 py-2 rounded-full text-xs font-bold bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {refundSending ? tt('account.invoices.refundSending') : tt('account.invoices.refundSubmit')}
          </button>
        </div>
      )}

      {refundMessage && (
        <div
          className={`px-3 py-2 rounded-lg text-sm ${
            refundMessage.ok
              ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] text-[var(--success)]'
              : 'bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]'
          }`}
        >
          {refundMessage.text}
        </div>
      )}
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
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}
