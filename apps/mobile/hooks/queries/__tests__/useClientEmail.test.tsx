import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { clientEmailService } from '@/services/client-email';
import { useVerifyClientEmail, useDeclineClientEmail, useRequestClientEmail } from '../useClientEmail';

beforeAll(() => { notifyManager.setNotifyFunction(callback => { act(callback); }); });
afterAll(() => { notifyManager.setNotifyFunction(callback => callback()); });

const mockUser = { id: 'client-1', role: 'CLIENT', isSuperAdmin: false };
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (select: (state: unknown) => unknown) => select({ auth: { token: 'token', user: mockUser } }),
}));
jest.mock('@/services/client', () => ({ clientProfileService: { getProfile: jest.fn(), updateProfile: jest.fn() } }));
jest.mock('@/services/client-email', () => ({
  clientEmailService: {
    getStatus: jest.fn(),
    request: jest.fn(),
    verify: jest.fn(),
    decline: jest.fn(),
  },
}));

const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

it('invalidates the email status and profile queries after a successful verification', async () => {
  jest.mocked(clientEmailService.verify).mockResolvedValue({ status: 'verified', email: 'a@example.test', pendingEmail: null, prompt: false });
  const { client, wrapper } = setup();
  client.setQueryData(['client', 'email-status'], { status: 'pending', email: null, pendingEmail: 'a@example.test', prompt: true });
  client.setQueryData(['client-profile', 'client-1'], { id: 'client-1' });
  const { result } = renderHook(() => useVerifyClientEmail(), { wrapper });
  await act(async () => { await result.current.mutateAsync({ challengeId: 'ch', code: '123456' }); });
  expect(clientEmailService.verify).toHaveBeenCalledWith({ challengeId: 'ch', code: '123456' });
  expect(client.getQueryState(['client', 'email-status'])?.isInvalidated).toBe(true);
  expect(client.getQueryState(['client-profile', 'client-1'])?.isInvalidated).toBe(true);
});
it('invalidates after declining the prompt', async () => {
  jest.mocked(clientEmailService.decline).mockResolvedValue({ status: 'none', email: null, pendingEmail: null, prompt: false });
  const { client, wrapper } = setup();
  client.setQueryData(['client', 'email-status'], { status: 'unverified', email: null, pendingEmail: null, prompt: true });
  const { result } = renderHook(() => useDeclineClientEmail(), { wrapper });
  await act(async () => { await result.current.mutateAsync(); });
  expect(client.getQueryState(['client', 'email-status'])?.isInvalidated).toBe(true);
});
it('keeps the cached status when a request fails', async () => {
  jest.mocked(clientEmailService.request).mockRejectedValue(new Error('send failed'));
  const cached = { status: 'none' as const, email: null, pendingEmail: null, prompt: false };
  const { client, wrapper } = setup();
  client.setQueryData(['client', 'email-status'], cached);
  const { result } = renderHook(() => useRequestClientEmail(), { wrapper });
  await act(async () => { await expect(result.current.mutateAsync({ email: 'a@example.test' })).rejects.toThrow('send failed'); });
  expect(client.getQueryData(['client', 'email-status'])).toEqual(cached);
  expect(client.getQueryState(['client', 'email-status'])?.isInvalidated).toBe(false);
});
