import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

let searchParams = new URLSearchParams();
const replaceMock = vi.fn();
const assignMock = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: replaceMock }),
}));

import PaymentCallbackPage from './page';

describe('/booking/payment-callback page', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    replaceMock.mockReset();
    assignMock.mockReset();
    vi.stubGlobal('location', { ...window.location, assign: assignMock });
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

  it('attempts the fixed native callback and keeps an encoded return link for mobile source', () => {
    searchParams = new URLSearchParams({
      source: 'mobile',
      bookingId: 'booking/id?mobile',
      invoiceId: 'invoice id&mobile',
    });

    const { getByRole } = render(<PaymentCallbackPage />);

    const nativeUrl =
      'sawa://booking/payment-callback?bookingId=booking%2Fid%3Fmobile&invoiceId=invoice+id%26mobile';
    expect(assignMock).toHaveBeenCalledWith(nativeUrl);
    expect(getByRole('link', { name: 'العودة إلى التطبيق' }).getAttribute('href')).toBe(nativeUrl);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('keeps unknown callback sources on the website confirmation route', () => {
    searchParams = new URLSearchParams({
      source: 'other',
      bookingId: 'bk_42',
      invoiceId: 'inv_7',
    });

    render(<PaymentCallbackPage />);

    expect(replaceMock).toHaveBeenCalledWith('/booking/confirm?bookingId=bk_42&invoiceId=inv_7');
    expect(assignMock).not.toHaveBeenCalled();
  });
});
