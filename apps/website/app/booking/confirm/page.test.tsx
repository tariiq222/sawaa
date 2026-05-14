import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

import BookingConfirmPage from './page';

describe('/booking/confirm page', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
  });

  it('renders success state with booking id', () => {
    searchParams = new URLSearchParams({ status: 'success', bookingId: 'bk_42' });
    render(<BookingConfirmPage />);
    expect(screen.getByRole('heading', { name: /booking confirmed/i })).toBeTruthy();
    expect(screen.getByText(/bk_42/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /book another appointment/i })).toBeTruthy();
  });

  it('renders failed state with retry CTA', () => {
    searchParams = new URLSearchParams({ status: 'failed', bookingId: 'bk_42' });
    render(<BookingConfirmPage />);
    expect(screen.getByRole('heading', { name: /payment failed/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /try again/i })).toBeTruthy();
  });

  it('renders pending state when status is missing or unknown', () => {
    searchParams = new URLSearchParams();
    render(<BookingConfirmPage />);
    expect(screen.getByText(/checking payment status/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /go to booking/i })).toBeTruthy();
  });
});
