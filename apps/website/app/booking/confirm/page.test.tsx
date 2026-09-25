import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrandingProvider } from '@/features/branding/branding-provider';
import { testBranding } from '@/test/fixtures/branding';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/lib/public-fetch', () => ({
  publicFetch: vi.fn(),
}));

import BookingConfirmPage from './page';
import { publicFetch } from '@/lib/public-fetch';

const publicFetchMock = publicFetch as ReturnType<typeof vi.fn>;

function renderPage() {
  render(<BrandingProvider branding={testBranding}><BookingConfirmPage /></BrandingProvider>);
}

describe('/booking/confirm page', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    publicFetchMock.mockReset();
  });

  it('renders success state with booking id', async () => {
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_42', status: 'CONFIRMED', paymentStatus: 'COMPLETED' });
    searchParams = new URLSearchParams({ status: 'success', bookingId: 'bk_42' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /تم تأكيد موعدك/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /احجز موعداً آخر/i })).toBeTruthy();
  });

  it('renders failed state with retry CTA', async () => {
    publicFetchMock.mockResolvedValue({ bookingId: 'bk_42', status: 'CANCELLED', paymentStatus: 'FAILED' });
    searchParams = new URLSearchParams({ status: 'failed', bookingId: 'bk_42' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /فشل الدفع/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /حاول مرة أخرى/i })).toBeTruthy();
  });

  it('renders failed state when bookingId is missing', () => {
    searchParams = new URLSearchParams();
    renderPage();
    expect(screen.getByRole('heading', { name: /فشل الدفع/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /حاول مرة أخرى/i })).toBeTruthy();
  });
});
