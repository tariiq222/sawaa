import type { ClientBookingItem, ClientInvoiceItem } from '@sawaa/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OverviewTab } from './overview-tab';
import { LocaleProvider } from '@/features/locale/locale-provider';
import { getMyBookingsApi } from '@/features/auth/auth.api';
import { getMyInvoicesApi } from './account.api';

vi.mock('@/features/auth/auth.api', () => ({ getMyBookingsApi: vi.fn() }));
vi.mock('./account.api', () => ({ getMyInvoicesApi: vi.fn() }));

function renderOverview() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LocaleProvider locale="en"><OverviewTab locale="en" onGoToInvoices={vi.fn()} /></LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMyBookingsApi).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
});

const invoice: ClientInvoiceItem = {
  id: 'invoice-1', number: 1, bookingId: null, serviceName: '', scheduledAt: null,
  subtotal: 17250, discountAmt: 0, vatRate: 0, vatAmt: 0, total: 17250,
  refundedAmount: 0, currency: 'SAR', status: 'PARTIALLY_PAID', paymentStatus: 'COMPLETED',
  issuedAt: null, paidAt: null, createdAt: '2026-09-01T00:00:00Z',
};

describe('OverviewTab balance', () => {
  it('shows the server balance and alert even when unpaid invoices are beyond the first page', async () => {
    vi.mocked(getMyInvoicesApi).mockResolvedValue({
      items: Array.from({ length: 50 }, (_, i) => ({ ...invoice, id: `paid-${i}`, status: 'PAID' as const })),
      total: 53, page: 1, pageSize: 50, outstandingBalance: 15000,
    });
    renderOverview();
    expect(await screen.findByText('150.00 SAR')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('shows the remaining amount rather than the full partially paid invoice total', async () => {
    vi.mocked(getMyInvoicesApi).mockResolvedValue({
      items: [invoice], total: 1, page: 1, pageSize: 50, outstandingBalance: 10000,
    });
    renderOverview();
    expect(await screen.findByText('100.00 SAR')).toBeTruthy();
    expect(screen.queryByText('172.50 SAR')).toBeNull();
  });

  it('shows zero and no unpaid alert when all invoices have been settled', async () => {
    vi.mocked(getMyInvoicesApi).mockResolvedValue({
      items: [], total: 0, page: 1, pageSize: 50, outstandingBalance: 0,
    });
    renderOverview();
    expect(await screen.findByText('0.00 SAR')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('OverviewTab bookings', () => {
  it('asks the server for the next upcoming booking after older records', async () => {
    const next: ClientBookingItem = {
      id: 'future-booking', status: 'CONFIRMED', scheduledAt: '2099-01-01T10:00:00Z',
      endsAt: '2099-01-01T11:00:00Z', durationMins: 60, price: '10000', currency: 'SAR',
      serviceName: 'Future session', serviceNameAr: null, employeeName: 'Counselor',
      employeeNameAr: null, branchName: 'Branch', branchNameAr: null,
      paymentStatus: 'COMPLETED', createdAt: '2026-01-01T00:00:00Z',
    };
    vi.mocked(getMyBookingsApi).mockImplementation(async (_page, _pageSize, tab) =>
      tab === 'upcoming'
        ? { items: [next], total: 1, page: 1, pageSize: 1 }
        : { items: [], total: 51, page: 1, pageSize: 1 },
    );
    vi.mocked(getMyInvoicesApi).mockResolvedValue({
      items: [], total: 0, page: 1, pageSize: 50, outstandingBalance: 0,
    });

    renderOverview();
    expect(await screen.findByText('Future session')).toBeTruthy();
    expect(getMyBookingsApi).toHaveBeenCalledWith(1, 1, 'upcoming');
    expect(getMyBookingsApi).toHaveBeenCalledWith(1, 1);
  });
});
