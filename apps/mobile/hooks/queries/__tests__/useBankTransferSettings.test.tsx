import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetSettings = jest.fn().mockResolvedValue({ enabled: false, accounts: [] });
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: {
  getBankTransferSettings: () => mockGetSettings(),
} }));
import { useBankTransferSettings } from '../useBankTransferSettings';

it('makes no bank-settings request until the caller enables the authenticated query', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook<ReturnType<typeof useBankTransferSettings>, { enabled: boolean }>(({ enabled }) => useBankTransferSettings(enabled), { initialProps: { enabled: false }, wrapper });
  expect(hook.result.current.fetchStatus).toBe('idle');
  expect(mockGetSettings).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(mockGetSettings).toHaveBeenCalledTimes(1);
  hook.unmount();
  client.clear();
});
