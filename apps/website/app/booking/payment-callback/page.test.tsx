import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

let searchParams = new URLSearchParams();
const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: replaceMock }),
}));

import PaymentCallbackPage from './page';

describe('/booking/payment-callback page', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    replaceMock.mockReset();
  });

  it('bounces to /booking/confirm preserving bookingId and invoiceId', () => {
    searchParams = new URLSearchParams({ bookingId: 'bk_42', invoiceId: 'inv_7' });
    render(<PaymentCallbackPage />);
    expect(replaceMock).toHaveBeenCalledWith('/booking/confirm?bookingId=bk_42&invoiceId=inv_7');
  });

  it('bounces to /booking/confirm without params when bookingId is missing', () => {
    searchParams = new URLSearchParams();
    render(<PaymentCallbackPage />);
    expect(replaceMock).toHaveBeenCalledWith('/booking/confirm');
  });
});
