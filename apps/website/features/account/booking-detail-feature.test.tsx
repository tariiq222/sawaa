import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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

// Wrap the timezone helper in a mock that defaults to the real implementation,
// so tests can both assert the exact payload conversion and simulate a helper
// rejection (invalid wall time) deterministically — jsdom sanitizes invalid
// date/time input values to '', which would make the confirm button disabled.
vi.mock('@/features/booking/booking-timezone', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/booking/booking-timezone')>();
  return { ...mod, riyadhWallTimeToUtcIso: vi.fn(mod.riyadhWallTimeToUtcIso) };
});

vi.mock('@/features/intake/intake-forms-section', () => ({
  IntakeFormsSection: () => <div data-testid="intake-forms" />,
}));

import { BookingDetailFeature } from './booking-detail-feature';
import { getMyBookingApi, cancelMyBookingApi, rescheduleMyBookingApi } from '@/features/auth/auth.api';
import { riyadhWallTimeToUtcIso } from '@/features/booking/booking-timezone';
import { LocaleProvider } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';

const getBookingMock = vi.mocked(getMyBookingApi);
const cancelMock = vi.mocked(cancelMyBookingApi);
const rescheduleMock = vi.mocked(rescheduleMyBookingApi);
const riyadhConvertMock = vi.mocked(riyadhWallTimeToUtcIso);

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

describe('BookingDetailFeature dialog keyboard focus', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    getBookingMock.mockReset();
    cancelMock.mockReset();
    getBookingMock.mockResolvedValue(booking());
  });

  /** Renders the feature and opens the cancel dialog, returning its trigger. */
  async function openCancelModal() {
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));
    const trigger = await screen.findByRole('button', { name: 'إلغاء الموعد' });
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
  }

  it('names the cancel dialog and moves focus to the reason textarea', async () => {
    await openCancelModal();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('إلغاء الموعد');
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('closes the cancel dialog on Escape and restores focus to the trigger', async () => {
    const trigger = await openCancelModal();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('wraps Tab within the cancel dialog back to the reason textarea', async () => {
    await openCancelModal();
    const confirm = screen.getByRole('button', { name: 'نعم، ألغِ الموعد' });
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('names the reschedule dialog, closes on Escape and restores focus to the trigger', async () => {
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));
    const trigger = await screen.findByRole('button', { name: 'إعادة جدولة الموعد' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('إعادة جدولة الموعد');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('wraps Tab within the reschedule dialog back to the date input', async () => {
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));
    const trigger = await screen.findByRole('button', { name: 'إعادة جدولة الموعد' });
    fireEvent.click(trigger);
    const confirm = screen.getByRole('button', { name: 'تأكيد' });
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(document.activeElement).toBe(document.querySelector('input[type="date"]'));
  });
});

describe('BookingDetailFeature dialog field labels', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    getBookingMock.mockReset();
    cancelMock.mockReset();
    getBookingMock.mockResolvedValue(booking());
  });

  it('labels the cancellation reason field in AR', async () => {
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));
    const trigger = await screen.findByRole('button', { name: 'إلغاء الموعد' });
    fireEvent.click(trigger);

    const reason = screen.getByLabelText('سبب الإلغاء (اختياري)');
    expect(reason.tagName).toBe('TEXTAREA');
  });

  it('labels the reschedule date and time fields in AR', async () => {
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));
    const trigger = await screen.findByRole('button', { name: 'إعادة جدولة الموعد' });
    fireEvent.click(trigger);

    expect(screen.getByLabelText('التاريخ الجديد')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('الوقت الجديد')).toHaveAttribute('type', 'time');
  });

  it('labels the cancel and reschedule fields in EN-compatible rendering', async () => {
    render(wrap('en', <BookingDetailFeature bookingId="bk_1" locale="en" />));
    const cancelTrigger = await screen.findByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelTrigger);

    const reason = screen.getByLabelText('Cancellation reason (optional)');
    expect(reason.tagName).toBe('TEXTAREA');
    fireEvent.click(screen.getByRole('button', { name: 'Keep booking' }));

    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    expect(screen.getByLabelText('New Date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('New Time')).toHaveAttribute('type', 'time');
  });
});

describe('BookingDetailFeature reschedule timezone conversion', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    getBookingMock.mockReset();
    cancelMock.mockReset();
    rescheduleMock.mockReset();
    getBookingMock.mockResolvedValue(booking());
    // Keep the real conversion as the default; only override per-test.
    riyadhConvertMock.mockClear();
  });

  it('sends the reschedule payload as Riyadh wall time converted to UTC (14:00 → 11:00Z)', async () => {
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));
    fireEvent.click(await screen.findByRole('button', { name: 'إعادة جدولة الموعد' }));

    fireEvent.change(screen.getByLabelText('التاريخ الجديد'), { target: { value: '2026-05-15' } });
    fireEvent.change(screen.getByLabelText('الوقت الجديد'), { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد' }));

    await waitFor(() => {
      expect(rescheduleMock).toHaveBeenCalledWith('bk_1', '2026-05-15T11:00:00.000Z');
    });
  });

  it('shows a localized Asia/Riyadh timezone note next to the date/time controls', async () => {
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));
    fireEvent.click(await screen.findByRole('button', { name: 'إعادة جدولة الموعد' }));

    expect(screen.getByText('بالتوقيت المحلي للرياض (UTC+3)')).toBeTruthy();
  });

  it('shows the EN timezone note in EN-compatible rendering', async () => {
    render(wrap('en', <BookingDetailFeature bookingId="bk_1" locale="en" />));
    fireEvent.click(await screen.findByRole('button', { name: 'Reschedule' }));

    expect(screen.getByText('Riyadh local time (UTC+3)')).toBeTruthy();
  });

  it('surfaces only the localized rescheduleFailed when the conversion rejects (no raw error)', async () => {
    riyadhConvertMock.mockImplementationOnce(() => {
      throw new RangeError('boom: invalid Riyadh wall time');
    });
    render(wrap('ar', <BookingDetailFeature bookingId="bk_1" locale="ar" />));
    fireEvent.click(await screen.findByRole('button', { name: 'إعادة جدولة الموعد' }));

    fireEvent.change(screen.getByLabelText('التاريخ الجديد'), { target: { value: '2026-05-15' } });
    fireEvent.change(screen.getByLabelText('الوقت الجديد'), { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد' }));

    expect(await screen.findByText('فشل إعادة الجدولة')).toBeTruthy();
    expect(screen.queryByText(/boom|RangeError/)).toBeNull();
    // The modal stays open so the client can retry with a valid time.
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
