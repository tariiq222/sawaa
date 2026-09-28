import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMyBookingsApi: vi.fn(),
  bookingsList: vi.fn(),
}));

vi.mock('@/features/locale/public', () => ({ getLocale: async () => 'ar' }));
vi.mock('@/features/locale/dictionary', () => ({ t: (_locale: string, key: string) => key }));
vi.mock('@/features/auth/auth.api', () => ({ getMyBookingsApi: mocks.getMyBookingsApi }));
vi.mock('@/features/auth/client-bookings-list', () => ({ ClientBookingsList: mocks.bookingsList }));

import { SawaaAccountBookingsPage } from './account-bookings';

function containsElement(node: unknown, type: unknown, locale: string): boolean {
  if (!node || typeof node !== 'object') return false;
  const element = node as { type?: unknown; props?: { locale?: string; children?: unknown } };
  if (element.type === type && element.props?.locale === locale) return true;
  const children = element.props?.children;
  return (Array.isArray(children) ? children : [children]).some((child) => containsElement(child, type, locale));
}

describe('SawaaAccountBookingsPage', () => {
  it('renders the shell without making an unused server booking request', async () => {
    mocks.getMyBookingsApi.mockClear();
    const tree = await SawaaAccountBookingsPage({ searchParams: Promise.resolve({ page: '9' }) });

    expect(mocks.getMyBookingsApi).not.toHaveBeenCalled();
    expect(containsElement(tree, mocks.bookingsList, 'ar')).toBe(true);
  });
});
