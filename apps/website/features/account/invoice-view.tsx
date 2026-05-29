'use client';

import { useLocale, useT } from '@/features/locale/locale-provider';
import type { InvoiceDetail } from './invoice.api';

interface InvoiceViewProps {
  invoice: InvoiceDetail;
}

const PRINT_STYLES = `
@media print {
  body { background: white !important; }
  .invoice-view-chrome { display: none !important; }
  .invoice-view-card {
    box-shadow: none !important;
    border: 1px solid #000 !important;
    break-inside: avoid;
  }
}
`;

export function InvoiceView({ invoice }: InvoiceViewProps) {
  const t = useT();
  const locale = useLocale();
  const sellerName = invoice.sellerName?.trim() || 'مركز سواء';

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div
        className="invoice-view-card"
        style={{
          background: 'var(--card)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            {t('invoice.title')}
          </h1>
          <p style={{ opacity: 0.9, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            {sellerName}
          </p>
          <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>#{invoice.id.slice(0, 8)}</p>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ opacity: 0.6, display: 'block' }}>{t('invoice.issueDate')}</span>
              <span>{formatDate(invoice.issuedAt, locale)}</span>
            </div>
            <div>
              <span style={{ opacity: 0.6, display: 'block' }}>{t('invoice.status')}</span>
              <span style={{ color: statusColor(invoice.status) }}>{invoice.status}</span>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              padding: '1rem 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.6 }}>{t('invoice.subtotal')}</span>
              <span>{formatCurrency(invoice.subtotal, invoice.currency, locale)}</span>
            </div>
            {invoice.discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                <span>{t('invoice.discount')}</span>
                <span>-{formatCurrency(invoice.discountAmt, invoice.currency, locale)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.6 }}>{t('invoice.vat')} ({(invoice.vatRate * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(invoice.vatAmt, invoice.currency, locale)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '1.125rem',
                paddingTop: '0.5rem',
              }}
            >
              <span>{t('invoice.total')}</span>
              <span>{formatCurrency(invoice.total, invoice.currency, locale)}</span>
            </div>
            {invoice.refundedAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)' }}>
                <span>{locale === 'ar' ? 'المبلغ المسترد' : 'Refunded'}</span>
                <span>-{formatCurrency(invoice.refundedAmount, invoice.currency, locale)}</span>
              </div>
            )}
          </div>

          <div
            className="invoice-view-chrome"
            style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', paddingTop: '0.5rem' }}
          >
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {t('invoice.print')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function statusColor(status: string): string {
  if (status === 'PAID') return 'var(--success)';
  if (status === 'PENDING') return 'var(--warning)';
  return 'var(--muted-foreground)';
}
