import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandingProvider } from '@/features/branding/branding-provider';
import { testBranding } from '@/test/fixtures/branding';

let searchParams = new URLSearchParams();
const replaceMock = vi.fn();
const assignMock = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: replaceMock }),
}));

import PaymentCallbackPage from './page';

function renderPage() {
  render(<BrandingProvider branding={testBranding}><PaymentCallbackPage /></BrandingProvider>);
}

describe('/booking/payment-callback page', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    replaceMock.mockReset();
    assignMock.mockReset();
    vi.stubGlobal('location', { ...window.location, assign: assignMock });
  });

  it('shows the payment choices inside the site navigation and theme', () => {
    renderPage();
    const main = screen.getByRole('main');
    expect(main.closest('.theme-sawaa')).not.toBeNull();
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(main.querySelectorAll('a')).toHaveLength(2);
  });

  it.each(['mobile', 'website', 'other', null])('offers both channels for source %s without automatic routing', (source) => {
    searchParams = new URLSearchParams({ bookingId: 'bk_42', invoiceId: 'inv_7' });
    if (source) searchParams.set('source', source);
    renderPage();
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
    renderPage();
    expect(screen.getByRole('link', { name: 'المتابعة في التطبيق' }).getAttribute('href'))
      .toBe('sawa://booking/payment-callback?bookingId=booking%2Fid%3Fx&invoiceId=invoice+id%26x');
    expect(screen.getByRole('link', { name: 'المتابعة على الموقع' }).getAttribute('href'))
      .toBe('/booking/confirm?bookingId=booking%2Fid%3Fx&invoiceId=invoice+id%26x');
    expect(assignMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('does not claim payment success when callback identifiers are absent', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'المتابعة في التطبيق' }).getAttribute('href'))
      .toBe('sawa://booking/payment-callback');
    expect(screen.getByRole('link', { name: 'المتابعة على الموقع' }).getAttribute('href'))
      .toBe('/booking/confirm');
    expect(screen.queryByText(/تم الدفع|تأكيد الدفع/)).toBeNull();
    expect(assignMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
