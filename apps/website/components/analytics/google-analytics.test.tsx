import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/features/locale/locale-provider';
import { GoogleAnalytics } from './google-analytics';

const route = vi.hoisted(() => ({ pathname: '/about' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const send = vi.fn<typeof fetch>();

function site() {
  return <LocaleProvider locale="en"><GoogleAnalytics /></LocaleProvider>;
}

describe('Google Analytics consent', () => {
  beforeEach(() => {
    route.pathname = '/about';
    window.localStorage.clear();
    window.sessionStorage.clear();
    send.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', send);
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks again after an older analytics choice, then measures only approved public pages', () => {
    window.localStorage.setItem('sawaa-consent', JSON.stringify({
      decision: 'all',
      decidedAt: '2026-01-01T00:00:00.000Z',
    }));
    const { rerender } = render(site());
    act(() => vi.advanceTimersByTime(200));
    expect(send).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith('/api/site-analytics', expect.objectContaining({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: expect.objectContaining({ 'x-sawaa-analytics-page': '/about' }),
    }));

    route.pathname = '/booking/confirm';
    rerender(site());
    expect(send).toHaveBeenCalledOnce();

    route.pathname = '/';
    rerender(site());
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('respects a decision to use only essential storage', () => {
    const { rerender } = render(site());
    act(() => vi.advanceTimersByTime(200));
    fireEvent.click(screen.getByRole('button', { name: 'Essential only' }));
    route.pathname = '/services';
    rerender(site());
    expect(send).not.toHaveBeenCalled();
  });
});
