import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGet = jest.fn();
jest.mock('@/services/api', () => ({ __esModule: true, default: { get: (...args: unknown[]) => mockGet(...args) } }));
import { useBookingOptions } from '../useBookingOptions';
import { useServicePriceFloors } from '../useServicePriceFloors';
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockImplementation((path: string) => Promise.resolve({ data: {
    useCustomPricing: true, disabledDeliveryTypes: [], options: [{
      deliveryType: 'IN_PERSON', durationOptionId: 'duration-1', durationMins: 60,
      price: path.includes('/service-a/') ? 10000 : 20000, currency: 'SAR', label: null,
    }],
  } }));
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
it('isolates priced options by service as well as practitioner', async () => {
  const { result } = renderHook(() => [useBookingOptions('service-a', 'employee-1'), useBookingOptions('service-b', 'employee-1')], { wrapper: setup() });
  await waitFor(() => expect(result.current.every((query) => query.isSuccess)).toBe(true));
  expect(result.current[0].data?.options[0].price).toBe(10000);
  expect(result.current[1].data?.options[0].price).toBe(20000);
});
it('shares the option resource with practitioner price cards for the same context', async () => {
  const employees = ['employee-1'];
  const { result } = renderHook(() => ({ options: useBookingOptions('service-a', 'employee-1'), floors: useServicePriceFloors('service-a', employees) }), { wrapper: setup() });
  await waitFor(() => expect(result.current.floors['employee-1']?.price).toBe(10000));
  expect(result.current.options.data?.options[0].price).toBe(10000);
  expect(mockGet).toHaveBeenCalledTimes(1);
});
