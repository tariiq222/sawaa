import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
}));

import { PaymentRedirect } from './payment-redirect';

describe('PaymentRedirect', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    replaceMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '', reload: vi.fn() },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('routes to /booking/confirm with status=failed when redirectUrl is empty', () => {
    render(<PaymentRedirect redirectUrl="" bookingId="bk_42" />);
    expect(replaceMock).toHaveBeenCalledWith('/booking/confirm?bookingId=bk_42&status=failed');
    expect(window.location.href).toBe('');
  });

  it('sets window.location.href when redirectUrl is provided', () => {
    render(<PaymentRedirect redirectUrl="https://moyasar.test/pay/abc" bookingId="bk_42" />);
    expect(replaceMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe('https://moyasar.test/pay/abc');
  });

  it('reloads the page when the retry button is clicked', () => {
    render(<PaymentRedirect redirectUrl="https://moyasar.test/pay/abc" bookingId="bk_42" />);
    fireEvent.click(screen.getByRole('button', { name: /click here if not redirected/i }));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
