import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientInvoiceItem } from '@sawaa/shared';

vi.mock('./account.api', () => ({
  getMyInvoicesApi: vi.fn(),
  requestRefundApi: vi.fn(),
}));

vi.mock('@/features/booking/booking.api', () => ({
  initPayment: vi.fn(),
}));

import { InvoicesTab } from './invoices-tab';
import { getMyInvoicesApi, requestRefundApi } from './account.api';
import { initPayment } from '@/features/booking/booking.api';
import { LocaleProvider } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';

const getInvoicesMock = vi.mocked(getMyInvoicesApi);
const requestRefundMock = vi.mocked(requestRefundApi);
const initPaymentMock = vi.mocked(initPayment);

function wrap(locale: Locale, children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}

function invoice(overrides: Partial<ClientInvoiceItem> = {}): ClientInvoiceItem {
  return {
    id: 'inv_1',
    number: 1042,
    bookingId: 'bk_1',
    serviceName: 'جلسة إرشاد أسري',
    scheduledAt: '2026-06-20T10:00:00.000Z',
    subtotal: 20000,
    discountAmt: 0,
    vatRate: 0.15,
    vatAmt: 3000,
    total: 23000,
    refundedAmount: 0,
    currency: 'SAR',
    status: 'ISSUED',
    paymentStatus: null,
    issuedAt: '2026-06-10T10:00:00.000Z',
    paidAt: null,
    createdAt: '2026-06-10T10:00:00.000Z',
    ...overrides,
  };
}

const assignMock = vi.fn();

describe('InvoicesTab', () => {
  beforeEach(() => {
    getInvoicesMock.mockReset();
    requestRefundMock.mockReset();
    initPaymentMock.mockReset();
    assignMock.mockReset();
    vi.stubGlobal('location', { ...window.location, assign: assignMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the empty state when there are no invoices', async () => {
    getInvoicesMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
    render(wrap('ar', <InvoicesTab locale="ar" />));
    expect(await screen.findByText('لا توجد فواتير بعد')).toBeTruthy();
  });

  it('renders a distinct error + retry state on a failed fetch, not the empty state', async () => {
    getInvoicesMock.mockRejectedValue(new Error('boom'));
    render(wrap('ar', <InvoicesTab locale="ar" />));

    expect(await screen.findByText('تعذّر تحميل البيانات، حاول مرة أخرى')).toBeTruthy();
    expect(screen.getByRole('button', { name: /إعادة المحاولة/ })).toBeTruthy();
    // The "you have nothing" empty state must NOT show on error.
    expect(screen.queryByText('لا توجد فواتير بعد')).toBeNull();
  });

  it('retry button refetches the invoices query', async () => {
    getInvoicesMock.mockRejectedValueOnce(new Error('boom'));
    getInvoicesMock.mockResolvedValueOnce({
      items: [invoice()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    render(wrap('ar', <InvoicesTab locale="ar" />));

    fireEvent.click(await screen.findByRole('button', { name: /إعادة المحاولة/ }));
    expect(await screen.findByText('جلسة إرشاد أسري')).toBeTruthy();
  });

  it('renders invoice cards with Arabic status labels and totals in SAR', async () => {
    getInvoicesMock.mockResolvedValue({
      items: [
        invoice(),
        invoice({ id: 'inv_2', number: 1043, status: 'PAID', total: 11500 }),
      ],
      total: 2,
      page: 1,
      pageSize: 50,
    });
    render(wrap('ar', <InvoicesTab locale="ar" />));

    expect(await screen.findAllByText('جلسة إرشاد أسري')).toHaveLength(2);
    // ISSUED → غير مدفوعة, PAID → مدفوعة
    expect(screen.getByText('غير مدفوعة')).toBeTruthy();
    expect(screen.getByText('مدفوعة')).toBeTruthy();
    // halalas → SAR
    expect(screen.getByText('230.00', { exact: false })).toBeTruthy();
    expect(screen.getByText('115.00', { exact: false })).toBeTruthy();
    // invoice link uses bookingId
    const viewLinks = screen.getAllByRole('link', { name: /عرض الفاتورة/ });
    expect(viewLinks[0]!.getAttribute('href')).toBe('/account/bookings/bk_1/invoice');
  });

  it('pay now calls initPayment with the invoice id and redirects', async () => {
    getInvoicesMock.mockResolvedValue({
      items: [invoice()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    initPaymentMock.mockResolvedValue({ paymentId: 'pay_1', redirectUrl: 'https://moyasar.test/redirect' });
    render(wrap('ar', <InvoicesTab locale="ar" />));

    fireEvent.click(await screen.findByRole('button', { name: /ادفع الآن/ }));

    await waitFor(() => expect(initPaymentMock).toHaveBeenCalledWith('inv_1'));
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('https://moyasar.test/redirect'));
  });

  it('shows an inline error when initPayment fails', async () => {
    getInvoicesMock.mockResolvedValue({
      items: [invoice()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    initPaymentMock.mockRejectedValue(new Error('boom'));
    render(wrap('ar', <InvoicesTab locale="ar" />));

    fireEvent.click(await screen.findByRole('button', { name: /ادفع الآن/ }));

    expect(await screen.findByText('تعذر بدء عملية الدفع، حاول مرة أخرى.')).toBeTruthy();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('refund request: PAID invoice exposes the form and submits via requestRefundApi', async () => {
    getInvoicesMock.mockResolvedValue({
      items: [invoice({ status: 'PAID', paymentStatus: 'COMPLETED' })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    requestRefundMock.mockResolvedValue({ status: 'REQUESTED' });
    render(wrap('ar', <InvoicesTab locale="ar" />));

    fireEvent.click(await screen.findByRole('button', { name: /طلب استرداد/ }));
    fireEvent.change(screen.getByLabelText('سبب الاسترداد (اختياري)'), {
      target: { value: 'ظرف طارئ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'إرسال الطلب' }));

    await waitFor(() => expect(requestRefundMock).toHaveBeenCalledWith('inv_1', 'ظرف طارئ'));
    expect(await screen.findByText('تم إرسال طلب الاسترداد بنجاح.')).toBeTruthy();
  });

  it('does not offer pay now for PAID invoices nor refund for ISSUED invoices', async () => {
    getInvoicesMock.mockResolvedValue({
      items: [invoice()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    render(wrap('ar', <InvoicesTab locale="ar" />));

    await screen.findByText('غير مدفوعة');
    expect(screen.queryByRole('button', { name: /طلب استرداد/ })).toBeNull();
    expect(screen.getByRole('button', { name: /ادفع الآن/ })).toBeTruthy();
  });
});
