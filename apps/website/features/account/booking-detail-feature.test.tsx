import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientBookingItem } from '@sawaa/shared';

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('@/features/auth/public', () => ({
  useCurrentClient: () => ({ client: { id: 'c1', name: 'Sara' }, isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('@/features/auth/auth.api', () => ({
  getMyBookingApi: vi.fn(),
  cancelMyBookingApi: vi.fn(),
  rescheduleMyBookingApi: vi.fn(),
}));

vi.mock('@/features/booking/booking.api', () => ({
  initPayment: vi.fn(),
}));

vi.mock('@/features/intake/intake-forms-section', () => ({
  IntakeFormsSection: () => <div data-testid="intake-forms" />,
}));

import { BookingDetailFeature } from './booking-detail-feature';
import { getMyBookingApi, cancelMyBookingApi } from '@/features/auth/auth.api';
import { LocaleProvider } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';

const getBookingMock = vi.mocked(getMyBookingApi);
const cancelMock = vi.mocked(cancelMyBookingApi);

function wrap(locale: Locale, children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

function booking(overrides: Partial<ClientBookingItem> = {}): ClientBookingItem {
  return {
    id: 'bk_1',
    status: 'CONFIRMED',
    scheduledAt: FUTURE,
    endsAt: FUTURE,
    durationMins: 60,
    price: '20000',
    currency: 'SAR',
    serviceName: 'جلسة إرشاد أسري',
    serviceNameAr: 'جلسة إرشاد أسري',
    employeeName: 'د. منى',
    employeeNameAr: 'د. منى',
    branchName: 'الفرع الرئيسي',
    branchNameAr: 'الفرع الرئيسي',
    paymentStatus: 'COMPLETED',
    createdAt: FUTURE,
    invoiceId: 'inv_1',
    invoiceStatus: 'PAID',
    deliveryType: 'IN_PERSON',
    zoomJoinUrl: null,
    ...overrides,
  };
}

async function openCancelAndConfirm() {
  fireEvent.click(await screen.findByRole('button', { name: 'إلغاء الموعد' }));
  fireEvent.click(screen.getByRole('button', { name: 'نعم، ألغِ الموعد' }));
}

describe('BookingDetailFeature', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    getBookingMock.mockReset();
    cancelMock.mockReset();
  });

  it('renders the price converted from halalas to SAR (regression: 20000 → 200.00)', async () => {
    getBookingMock.mockResolvedValue(booking());
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));

    expect(await screen.findByText(/200\.00/)).toBeTruthy();
    expect(screen.queryByText(/20000/)).toBeNull();
  });

  it('shows an immediate-cancellation message and updates the status pill on cancel', async () => {
    getBookingMock.mockResolvedValue(booking());
    cancelMock.mockResolvedValue({ status: 'CANCELLED', requiresApproval: false });
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));

    await openCancelAndConfirm();

    expect(await screen.findByText('تم إلغاء الموعد')).toBeTruthy();
    expect(screen.getByText('ملغي')).toBeTruthy();
    // Cancel/reschedule actions disappear once cancelled
    expect(screen.queryByRole('button', { name: 'إلغاء الموعد' })).toBeNull();
  });

  it('renders a distinct error + retry state on a failed fetch, not the notFound copy', async () => {
    getBookingMock.mockRejectedValue(new Error('boom'));
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));

    expect(await screen.findByText('تعذّر تحميل البيانات، حاول مرة أخرى')).toBeTruthy();
    expect(screen.getByRole('button', { name: /إعادة المحاولة/ })).toBeTruthy();
    // notFound copy is reserved for a real 404 / empty success, not a thrown error.
    expect(screen.queryByText(/الموعد غير موجود/)).toBeNull();
  });

  it('shows the approval-pending message and a localized CANCEL_REQUESTED pill', async () => {
    getBookingMock.mockResolvedValue(booking());
    cancelMock.mockResolvedValue({ status: 'CANCEL_REQUESTED', requiresApproval: true });
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));

    await openCancelAndConfirm();

    expect(await screen.findByText('تم إرسال طلب الإلغاء وبانتظار موافقة المركز')).toBeTruthy();
    expect(screen.getByText('بانتظار موافقة الإلغاء')).toBeTruthy();
    // No raw English enum leaks
    expect(screen.queryByText('CANCEL_REQUESTED')).toBeNull();
  });
});
