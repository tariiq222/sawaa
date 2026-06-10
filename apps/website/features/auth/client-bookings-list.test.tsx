import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientBookingItem } from '@sawaa/shared';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/features/auth/auth.api', () => ({
  getMyBookingsApi: vi.fn(),
}));

vi.mock('@/features/booking/booking.api', () => ({
  initPayment: vi.fn(),
}));

import { ClientBookingsList } from './client-bookings-list';
import { getMyBookingsApi } from '@/features/auth/auth.api';
import { initPayment } from '@/features/booking/booking.api';
import { LocaleProvider } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';

const getBookingsMock = vi.mocked(getMyBookingsApi);
const initPaymentMock = vi.mocked(initPayment);

function wrap(locale: Locale, children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

function booking(overrides: Partial<ClientBookingItem> = {}): ClientBookingItem {
  return {
    id: 'bk_1',
    status: 'CONFIRMED',
    scheduledAt: FUTURE,
    endsAt: FUTURE,
    durationMins: 60,
    price: '23000',
    currency: 'SAR',
    serviceName: 'جلسة إرشاد أسري',
    serviceNameAr: 'جلسة إرشاد أسري',
    employeeName: 'د. منى',
    employeeNameAr: 'د. منى',
    branchName: 'الفرع الرئيسي',
    branchNameAr: 'الفرع الرئيسي',
    paymentStatus: 'COMPLETED',
    createdAt: PAST,
    invoiceId: 'inv_1',
    invoiceStatus: 'PAID',
    deliveryType: 'IN_PERSON',
    zoomJoinUrl: null,
    ...overrides,
  };
}

const assignMock = vi.fn();

describe('ClientBookingsList', () => {
  beforeEach(() => {
    pushMock.mockReset();
    getBookingsMock.mockReset();
    initPaymentMock.mockReset();
    assignMock.mockReset();
    vi.stubGlobal('location', { ...window.location, assign: assignMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the cancelled tab and excludes cancelled bookings from upcoming/past', async () => {
    getBookingsMock.mockResolvedValue({
      items: [
        booking(),
        booking({ id: 'bk_2', status: 'CANCELLED', scheduledAt: FUTURE }),
        booking({ id: 'bk_3', status: 'CANCEL_REQUESTED', scheduledAt: PAST }),
      ],
      total: 3,
      page: 1,
      pageSize: 50,
    });
    render(wrap('ar', <ClientBookingsList locale="ar" />));

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((el) => el.textContent)).toEqual(['القادمة1', 'السابقة0', 'ملغاة2']);

    // upcoming tab shows only the non-cancelled booking
    expect(screen.getAllByText('جلسة إرشاد أسري')).toHaveLength(1);

    fireEvent.click(screen.getByRole('tab', { name: /ملغاة/ }));
    expect(screen.getAllByText('جلسة إرشاد أسري')).toHaveLength(2);
  });

  it('renders the price converted from halalas to SAR, never the raw amount', async () => {
    getBookingsMock.mockResolvedValue({
      items: [booking({ price: '20000' })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    render(wrap('ar', <ClientBookingsList locale="ar" />));

    // 20000 halalas = 200.00 SAR
    expect(await screen.findByText(/200\.00/)).toBeTruthy();
    expect(screen.queryByText(/20000/)).toBeNull();
  });

  it('renders a localized payment-status pill on each card', async () => {
    getBookingsMock.mockResolvedValue({
      items: [booking({ paymentStatus: 'PENDING', invoiceStatus: 'ISSUED' })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    render(wrap('ar', <ClientBookingsList locale="ar" />));

    expect(await screen.findByText('قيد الدفع')).toBeTruthy();
    // No raw English enum leaks
    expect(screen.queryByText('PENDING')).toBeNull();
  });

  it('shows pay now for ISSUED invoices and starts the payment flow', async () => {
    getBookingsMock.mockResolvedValue({
      items: [booking({ paymentStatus: 'UNKNOWN', invoiceStatus: 'ISSUED', invoiceId: 'inv_9' })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    initPaymentMock.mockResolvedValue({ paymentId: 'pay_1', redirectUrl: 'https://moyasar.test/r' });
    render(wrap('ar', <ClientBookingsList locale="ar" />));

    // exact name match: the card itself also has role="button" and its
    // accessible name contains the pay label, so a regex would be ambiguous.
    fireEvent.click(await screen.findByRole('button', { name: 'ادفع الآن' }));

    await waitFor(() => expect(initPaymentMock).toHaveBeenCalledWith('inv_9'));
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('https://moyasar.test/r'));
    // clicking pay must not navigate to the booking detail
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('hides pay now for paid invoices', async () => {
    getBookingsMock.mockResolvedValue({
      items: [booking({ invoiceStatus: 'PAID' })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    render(wrap('ar', <ClientBookingsList locale="ar" />));

    await screen.findByText('جلسة إرشاد أسري');
    expect(screen.queryByRole('button', { name: /ادفع الآن/ })).toBeNull();
  });
});
