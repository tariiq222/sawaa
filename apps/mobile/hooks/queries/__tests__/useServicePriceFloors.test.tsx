import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetOptions = jest.fn();
jest.mock('@/features/booking/booking-options', () => ({
  getPractitionerBookingOptions: (...args: unknown[]) => mockGetOptions(...args),
}));

import { useServicePriceFloors } from '../useServicePriceFloors';

const option = (price: number) => ({ price, currency: 'SAR' });

let client: QueryClient;
// gcTime: 0 keeps react-query's garbage-collection timer from holding the jest process open.
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useServicePriceFloors', () => {
  beforeEach(() => {
    mockGetOptions.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('picks the lowest option price per employee', async () => {
    mockGetOptions.mockResolvedValue({ options: [option(30000), option(20000), option(25000)] });
    const ids = ['e1'];
    const { result } = renderHook(() => useServicePriceFloors('s1', ids), { wrapper });
    await waitFor(() => expect(result.current.e1).toEqual({ price: 20000, currency: 'SAR' }));
    expect(mockGetOptions).toHaveBeenCalledWith('s1', 'e1');
  });

  it('leaves out an id whose request fails while the other resolves', async () => {
    mockGetOptions.mockImplementation((_service: string, employeeId: string) =>
      (employeeId === 'bad' ? Promise.reject(new Error('boom')) : Promise.resolve({ options: [option(15000)] })));
    const ids = ['bad', 'good'];
    const { result } = renderHook(() => useServicePriceFloors('s1', ids), { wrapper });
    await waitFor(() => expect(result.current.good).toEqual({ price: 15000, currency: 'SAR' }));
    await waitFor(() => expect(client.getQueryState(['booking-options', 's1', 'bad'])?.status).toBe('error'));
    expect(result.current.bad).toBeUndefined();
  });

  it('leaves out an id with no options', async () => {
    mockGetOptions.mockResolvedValue({ options: [] });
    const ids = ['e1'];
    const { result } = renderHook(() => useServicePriceFloors('s1', ids), { wrapper });
    await waitFor(() => expect(mockGetOptions).toHaveBeenCalled());
    await waitFor(() => expect(client.getQueryState(['booking-options', 's1', 'e1'])?.status).toBe('success'));
    expect(result.current).toEqual({});
  });

  it('sends no request without a service id', () => {
    const ids = ['e1'];
    const { result } = renderHook(() => useServicePriceFloors(undefined, ids), { wrapper });
    expect(mockGetOptions).not.toHaveBeenCalled();
    expect(result.current).toEqual({});
  });

  it('marks every query silent so a failed price never raises the global alert', async () => {
    mockGetOptions.mockResolvedValue({ options: [option(10000)] });
    const ids = ['e1', 'e2'];
    renderHook(() => useServicePriceFloors('s1', ids), { wrapper });
    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(2));
    client.getQueryCache().getAll().forEach((query) => expect(query.meta).toMatchObject({ silentError: true }));
  });
});
