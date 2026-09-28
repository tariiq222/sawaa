import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { BrandingProvider } from '@/features/branding/branding-provider';
import { testBranding } from '@/test/fixtures/branding';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/lib/public-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/public-fetch')>();
  return {
    ...actual,
    publicFetch: vi.fn(),
  };
});

import BookingConfirmPage from './page';
import { publicFetch, PublicFetchError } from '@/lib/public-fetch';

const publicFetchMock = publicFetch as ReturnType<typeof vi.fn>;

function renderPage() {
  return render(
    <BrandingProvider branding={testBranding}>
      <BookingConfirmPage />
    </BrandingProvider>
  );
}

describe('/booking/confirm page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    searchParams = new URLSearchParams();
    publicFetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses actual imported PublicFetchError class from public-fetch', () => {
    const error = new PublicFetchError(404, { message: 'Booking not found' });
    expect(error).toBeInstanceOf(PublicFetchError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(404);
    expect(error.name).toBe('PublicFetchError');
  });

  it('renders success state with booking id', async () => {
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_42', status: 'CONFIRMED', paymentStatus: 'COMPLETED' });
    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /تم تأكيد موعدك/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /احجز موعداً آخر/i })).toBeTruthy();
  });

  it('renders deposit_paid state with booking id', async () => {
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_42', status: 'DEPOSIT_PAID', paymentStatus: 'COMPLETED' });
    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /تم دفع العربون/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /عرض مواعيدي/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /احجز موعداً آخر/i })).toBeTruthy();
  });

  it('renders failed state with retry CTA when status is CANCELLED/FAILED', async () => {
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_42', status: 'CANCELLED', paymentStatus: 'FAILED' });
    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /فشل الدفع/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /حاول مرة أخرى/i })).toBeTruthy();
  });

  it('renders invalid reference state when bookingId is missing and does not call publicFetch', () => {
    searchParams = new URLSearchParams();
    renderPage();
    expect(screen.getByRole('heading', { name: /مرجع الموعد غير صالح/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /فشل الدفع/i })).toBeNull();
    expect(screen.getByRole('link', { name: /احجز موعداً آخر/i })).toBeTruthy();
    expect(publicFetchMock).not.toHaveBeenCalled();
  });

  it('terminal reference: immediately stops polling on 400 Bad Request without retry', async () => {
    publicFetchMock.mockRejectedValue(new PublicFetchError(400, { message: 'Invalid UUID' }));
    searchParams = new URLSearchParams({ bookingId: 'invalid-id' });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /مرجع الموعد غير صالح/i })).toBeTruthy();
    });
    expect(publicFetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: /فشل الدفع/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /جارٍ معالجة الدفع/i })).toBeNull();
  });

  it('terminal reference: immediately stops polling on 404 Not Found without retry', async () => {
    publicFetchMock.mockRejectedValue(new PublicFetchError(404, { message: 'Booking not found' }));
    searchParams = new URLSearchParams({ bookingId: 'nonexistent-id' });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /مرجع الموعد غير صالح/i })).toBeTruthy();
    });
    expect(publicFetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: /فشل الدفع/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /جارٍ معالجة الدفع/i })).toBeNull();
  });

  it('transient network error: recovers on next poll and displays success', async () => {
    vi.useFakeTimers();
    publicFetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ bookingId: 'bk_42', status: 'CONFIRMED', paymentStatus: 'COMPLETED' });

    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    renderPage();

    expect(publicFetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(publicFetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: /تم تأكيد موعدك/i })).toBeTruthy();
  });

  it('transient network error: exhausts retries, shows unable-to-verify state, and retries on button click', async () => {
    vi.useFakeTimers();
    publicFetchMock.mockRejectedValue(new Error('Transient fetch error'));

    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    renderPage();

    expect(publicFetchMock).toHaveBeenCalledTimes(1);

    for (let i = 2; i <= 10; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(publicFetchMock).toHaveBeenCalledTimes(i);
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(publicFetchMock).toHaveBeenCalledTimes(10);

    expect(screen.getByRole('heading', { name: /تعذّر التحقق من حالة الدفع/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /فشل الدفع/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /جارٍ معالجة الدفع/i })).toBeNull();

    const retryButton = screen.getByRole('button', { name: /تحقق من الحالة مرة أخرى/i });
    publicFetchMock.mockResolvedValueOnce({ bookingId: 'bk_42', status: 'CONFIRMED', paymentStatus: 'COMPLETED' });

    await act(async () => {
      fireEvent.click(retryButton);
    });

    expect(publicFetchMock).toHaveBeenCalledTimes(11);
    expect(screen.getByRole('heading', { name: /تم تأكيد موعدك/i })).toBeTruthy();
  });

  it('mixed sequence: pending -> transient error -> success recovery', async () => {
    vi.useFakeTimers();
    publicFetchMock
      .mockResolvedValueOnce({ bookingId: 'bk_42', status: 'PENDING', paymentStatus: 'PENDING' })
      .mockRejectedValueOnce(new Error('Transient connection drop'))
      .mockResolvedValueOnce({ bookingId: 'bk_42', status: 'CONFIRMED', paymentStatus: 'COMPLETED' });

    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    renderPage();

    expect(publicFetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(publicFetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(publicFetchMock).toHaveBeenCalledTimes(3);

    expect(screen.getByRole('heading', { name: /تم تأكيد موعدك/i })).toBeTruthy();
  });

  it('mixed sequence: pending attempts followed by transient errors settles on unable-to-verify', async () => {
    vi.useFakeTimers();
    for (let i = 1; i <= 5; i++) {
      publicFetchMock.mockResolvedValueOnce({ bookingId: 'bk_42', status: 'PENDING', paymentStatus: 'PENDING' });
    }
    for (let i = 6; i <= 10; i++) {
      publicFetchMock.mockRejectedValueOnce(new Error('Gateway Timeout'));
    }

    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    renderPage();

    for (let i = 1; i <= 9; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    }

    expect(publicFetchMock).toHaveBeenCalledTimes(10);
    expect(screen.getByRole('heading', { name: /تعذّر التحقق من حالة الدفع/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /جارٍ معالجة الدفع/i })).toBeNull();
  });

  it('mixed sequence: transient errors followed by pending attempts settles on payment processing', async () => {
    vi.useFakeTimers();
    for (let i = 1; i <= 5; i++) {
      publicFetchMock.mockRejectedValueOnce(new Error('Network error'));
    }
    for (let i = 6; i <= 10; i++) {
      publicFetchMock.mockResolvedValueOnce({ bookingId: 'bk_42', status: 'PENDING', paymentStatus: 'PENDING' });
    }

    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    renderPage();

    for (let i = 1; i <= 9; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    }

    expect(publicFetchMock).toHaveBeenCalledTimes(10);
    expect(screen.getByRole('heading', { name: /جارٍ معالجة الدفع/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /تعذّر التحقق من حالة الدفع/i })).toBeNull();
  });

  it('true pending: exhausts retries, shows payment processing state, and retries on button click', async () => {
    vi.useFakeTimers();
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_42', status: 'PENDING', paymentStatus: 'PENDING' });

    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    renderPage();

    expect(publicFetchMock).toHaveBeenCalledTimes(1);

    for (let i = 2; i <= 10; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(publicFetchMock).toHaveBeenCalledTimes(i);
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(publicFetchMock).toHaveBeenCalledTimes(10);

    expect(screen.getByRole('heading', { name: /جارٍ معالجة الدفع/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /فشل الدفع/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /تعذّر التحقق من حالة الدفع/i })).toBeNull();

    const retryButton = screen.getByRole('button', { name: /تحقق من الحالة مرة أخرى/i });
    publicFetchMock.mockResolvedValueOnce({ bookingId: 'bk_42', status: 'CONFIRMED', paymentStatus: 'COMPLETED' });

    await act(async () => {
      fireEvent.click(retryButton);
    });

    expect(publicFetchMock).toHaveBeenCalledTimes(11);
    expect(screen.getByRole('heading', { name: /تم تأكيد موعدك/i })).toBeTruthy();
  });

  it('unmount cleans up timers and prevents further polling', async () => {
    vi.useFakeTimers();
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_42', status: 'PENDING', paymentStatus: 'PENDING' });

    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    const { unmount } = renderPage();

    expect(publicFetchMock).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(publicFetchMock).toHaveBeenCalledTimes(1);
  });

  it('unmount aborts in-flight publicFetch via AbortController signal', () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | null | undefined;
    publicFetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return new Promise(() => {}); // stays in flight
    });

    searchParams = new URLSearchParams({ bookingId: 'bk_42' });
    const { unmount } = renderPage();

    expect(publicFetchMock).toHaveBeenCalledTimes(1);
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('bookingId change cancels previous poll timer and starts polling for new bookingId', async () => {
    vi.useFakeTimers();
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_1', status: 'PENDING', paymentStatus: 'PENDING' });

    searchParams = new URLSearchParams({ bookingId: 'bk_1' });
    const { rerender } = renderPage();

    expect(publicFetchMock).toHaveBeenCalledTimes(1);
    expect(publicFetchMock).toHaveBeenLastCalledWith(
      '/public/bookings/bk_1/status',
      expect.anything()
    );

    searchParams = new URLSearchParams({ bookingId: 'bk_2' });
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_2', status: 'CONFIRMED', paymentStatus: 'COMPLETED' });

    rerender(
      <BrandingProvider branding={testBranding}>
        <BookingConfirmPage />
      </BrandingProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(publicFetchMock).toHaveBeenCalledTimes(2);
    expect(publicFetchMock).toHaveBeenLastCalledWith(
      '/public/bookings/bk_2/status',
      expect.anything()
    );
    expect(screen.getByRole('heading', { name: /تم تأكيد موعدك/i })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(publicFetchMock).toHaveBeenCalledTimes(2);
  });

  it('bookingId changing to null cancels active polling and transitions to invalid reference state', async () => {
    vi.useFakeTimers();
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_1', status: 'PENDING', paymentStatus: 'PENDING' });

    searchParams = new URLSearchParams({ bookingId: 'bk_1' });
    const { rerender } = renderPage();

    expect(publicFetchMock).toHaveBeenCalledTimes(1);

    searchParams = new URLSearchParams();

    rerender(
      <BrandingProvider branding={testBranding}>
        <BookingConfirmPage />
      </BrandingProvider>
    );

    expect(screen.getByRole('heading', { name: /مرجع الموعد غير صالح/i })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(publicFetchMock).toHaveBeenCalledTimes(1);
  });
});
