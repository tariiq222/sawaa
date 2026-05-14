'use client';

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
            Invoice
          </h1>
          <p style={{ opacity: 0.9, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            {sellerName}
          </p>
          <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>#{invoice.id.slice(0, 8)}</p>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ opacity: 0.6, display: 'block' }}>Issue Date</span>
              <span>{formatDate(invoice.issuedAt)}</span>
            </div>
            <div>
              <span style={{ opacity: 0.6, display: 'block' }}>Status</span>
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
              <span style={{ opacity: 0.6 }}>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discountAmt, invoice.currency)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.6 }}>VAT ({(invoice.vatRate * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(invoice.vatAmt, invoice.currency)}</span>
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
              <span>Total</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
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
              Print Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency,
  }).format(amount);
}

function statusColor(status: string): string {
  if (status === 'PAID') return 'var(--success)';
  if (status === 'PENDING') return 'var(--warning)';
  return 'var(--muted-foreground)';
}
