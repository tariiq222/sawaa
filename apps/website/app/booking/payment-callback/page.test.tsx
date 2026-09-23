import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

  it.each(['mobile', 'website', 'other', null])('offers both channels for source %s without automatic routing', (source) => {
    searchParams = new URLSearchParams({ bookingId: 'bk_42', invoiceId: 'inv_7' });
    if (source) searchParams.set('source', source);
    render(<PaymentCallbackPage />);
    expect(screen.getByRole('link', { name: 'المتابعة في التطبيق' }).getAttribute('href'))
      .toBe('sawa://booking/payment-callback?bookingId=bk_42&invoiceId=inv_7');
    expect(screen.getByRole('link', { name: 'المتابعة على الموقع' }).getAttribute('href'))
      .toBe('/booking/confirm?bookingId=bk_42&invoiceId=inv_7');
    expect(assignMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('encodes identifiers and ignores untrusted callback routing parameters', () => {
    searchParams = new URLSearchParams({
      source: 'mobile', bookingId: 'booking/id?x', invoiceId: 'invoice id&x',
      returnUrl: 'https://attacker.example/',
    });
    render(<PaymentCallbackPage />);
    expect(screen.getByRole('link', { name: 'المتابعة في التطبيق' }).getAttribute('href'))
      .toBe('sawa://booking/payment-callback?bookingId=booking%2Fid%3Fx&invoiceId=invoice+id%26x');
    expect(screen.getByRole('link', { name: 'المتابعة على الموقع' }).getAttribute('href'))
      .toBe('/booking/confirm?bookingId=booking%2Fid%3Fx&invoiceId=invoice+id%26x');
    expect(assignMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('does not claim payment success when callback identifiers are absent', () => {
    render(<PaymentCallbackPage />);
    expect(screen.getByRole('link', { name: 'المتابعة في التطبيق' }).getAttribute('href'))
      .toBe('sawa://booking/payment-callback');
    expect(screen.getByRole('link', { name: 'المتابعة على الموقع' }).getAttribute('href'))
      .toBe('/booking/confirm');
    expect(screen.queryByText(/تم الدفع|تأكيد الدفع/)).toBeNull();
    expect(assignMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
