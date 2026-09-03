import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getInvoiceMock, notFoundMock } = vi.hoisted(() => ({
  getInvoiceMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: () => [] })),
}));
vi.mock('next/navigation', () => ({ notFound: notFoundMock }));
vi.mock('@/features/account/invoice.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/account/invoice.api')>();
  return { ...actual, getMyBookingInvoice: getInvoiceMock };
});
vi.mock('@/themes/registry', () => ({
  theme: { Layout: ({ children }: { children: React.ReactNode }) => children },
}));

import { PublicFetchError } from '@/lib/public-fetch';
import AccountBookingInvoicePage from './page';

describe('AccountBookingInvoicePage error routing', () => {
  beforeEach(() => {
    getInvoiceMock.mockReset();
    notFoundMock.mockClear();
  });

  it('uses notFound only for an actual backend 404', async () => {
    getInvoiceMock.mockRejectedValue(new PublicFetchError(404, { message: 'missing' }));
    await expect(AccountBookingInvoicePage({ params: Promise.resolve({ id: 'bk1' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows server failures so the route error boundary handles them', async () => {
    const failure = new PublicFetchError(500, { message: 'down' });
    getInvoiceMock.mockRejectedValue(failure);
    await expect(AccountBookingInvoicePage({ params: Promise.resolve({ id: 'bk1' }) })).rejects.toBe(failure);
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
