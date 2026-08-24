import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';

// `window.location.reload` is a non-configurable own property in jsdom
// (descriptor: writable=false, configurable=false), so we can't spy on it
// directly. Instead, beforeEach replaces the whole `window.location`
// accessor with a clone that carries a tracked noop `reload`. We keep a
// reference here so each test can assert against it.
let reloadMock: ReturnType<typeof vi.fn>;
let originalLocation: Location;

// Isolate the component from locale, branding, and consent dependencies.
vi.mock('@/features/locale/locale-provider', () => ({
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
  useLocale: () => 'en',
  useT: () => (key: string) => key,
}));
vi.mock('@/features/branding/public', () => ({
  useBranding: () => ({ contactPhone: '966500000000' }),
}));
vi.mock('@/components/consent/cookie-consent-banner', () => ({
  hasAnalyticsConsent: () => false,
}));

import { FloatingWhatsApp } from './floating-whatsapp';

describe('FloatingWhatsApp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    // Reload must never be called — clicking dismiss must update
    // localStorage + state in place. `window.location.reload` is a
    // non-configurable own property in jsdom, so we can't spy on it
    // directly; instead we replace `window.location` with a clone
    // whose `reload` is a tracked noop. (window.location itself is
    // configurable.)
    originalLocation = window.location;
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    // Restore the real window.location for the next test.
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
  });

  it('renders nothing during the server render so hydration matches the first client render', () => {
    // renderToString does not run effects, so it produces the same HTML
    // as the server render. After the mount-gate fix, that output is
    // empty — proving the first client render can match.
    const html = renderToString(<FloatingWhatsApp phone="966500000000" />);
    expect(html).toBe('');
  });

  it('renders the WhatsApp trigger button after mount with empty localStorage', () => {
    render(<FloatingWhatsApp phone="966500000000" />);
    // The mount effect fires inside render(); with empty localStorage
    // and no cooldown hit, the trigger button is in the DOM.
    const trigger = screen.getByRole('button', { name: 'whatsapp.cta' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The dismiss X is only shown when the chat dialog is open.
    expect(screen.queryByRole('button', { name: 'whatsapp.dismiss' })).toBeNull();
  });

  it('renders nothing when localStorage holds a timestamp inside the 24h cooldown', () => {
    // 1 hour ago — well inside the 24h cooldown.
    window.localStorage.setItem(
      'sawaa-chat-dismissed-at',
      String(Date.now() - 60 * 60 * 1000),
    );
    render(<FloatingWhatsApp phone="966500000000" />);
    // Advance well past the 1.5s visibility delay too, to be sure the
    // component isn't just waiting on the timer.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('button', { name: 'whatsapp.cta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'whatsapp.dismiss' })).toBeNull();
  });

  it('renders the button when localStorage holds a timestamp older than 24h', () => {
    // 25 hours ago — past the cooldown; the button should reappear.
    window.localStorage.setItem(
      'sawaa-chat-dismissed-at',
      String(Date.now() - 25 * 60 * 60 * 1000),
    );
    render(<FloatingWhatsApp phone="966500000000" />);
    expect(screen.getByRole('button', { name: 'whatsapp.cta' })).toBeInTheDocument();
  });

  it('clicking dismiss writes a fresh timestamp, hides the component, and never reloads the page', () => {
    render(<FloatingWhatsApp phone="966500000000" />);
    // Open the dialog so the X dismiss button becomes visible.
    fireEvent.click(screen.getByRole('button', { name: 'whatsapp.cta' }));
    expect(screen.getByRole('button', { name: 'whatsapp.dismiss' })).toBeInTheDocument();

    // Click dismiss. The component should:
    //   1. write a fresh timestamp to localStorage
    //   2. hide itself (no more buttons in the DOM)
    //   3. NOT call window.location.reload (which would destroy the
    //      booking wizard's in-progress client state).
    fireEvent.click(screen.getByRole('button', { name: 'whatsapp.dismiss' }));

    const stored = window.localStorage.getItem('sawaa-chat-dismissed-at');
    expect(stored).not.toBeNull();
    expect(Number.isFinite(Number(stored))).toBe(true);
    expect(screen.queryByRole('button', { name: 'whatsapp.cta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'whatsapp.dismiss' })).toBeNull();
    expect(reloadMock).not.toHaveBeenCalled();
  });
});