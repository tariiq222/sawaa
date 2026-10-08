import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let mockEpoch = 1;
let mockUser = { id: 'employee-user-1', email: 'old@example.com' };
const mockDispatch = jest.fn();
const mockUpload = jest.fn();
const mockRequest = jest.fn();
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (select: (s: unknown) => unknown) => select({ auth: { user: mockUser } }),
  useAppDispatch: () => mockDispatch,
}));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => mockEpoch, isSessionCurrent: (epoch: number) => epoch === mockEpoch }));
jest.mock('@/services/employee/profile', () => ({ employeeProfileService: {
  uploadAvatar: (...args: unknown[]) => mockUpload(...args),
  requestContact: (...args: unknown[]) => mockRequest(...args),
} }));
import { useUploadEmployeeAvatar, useRequestEmployeeContact } from '../useEmployeeProfile';

const profile = { id: 'employee-1', name: 'Sara', email: 'old@example.com', phone: null, avatarUrl: '/new.png', bioAr: null, bioEn: null, experience: 3, languages: [] };
const image = { uri: 'file:///photo.png', name: 'photo.png', type: 'image/png' };
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
beforeEach(() => { mockEpoch = 1; mockUser = { id: 'employee-user-1', email: 'old@example.com' }; jest.clearAllMocks(); mockUpload.mockResolvedValue(profile); });
afterEach(() => clients.splice(0).forEach(client => client.clear()));

it('rejects an image-picker callback retained across account replacement before uploading', async () => {
  const { client, wrapper } = setup();
  const { result, rerender } = renderHook(() => useUploadEmployeeAvatar(), { wrapper });
  const retainedUpload = result.current.mutateAsync;
  mockEpoch += 1;
  mockUser = { id: 'employee-user-2', email: 'second@example.com' };
  rerender({});
  await act(async () => { await expect(retainedUpload(image)).rejects.toThrow('Session changed'); });
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(client.getQueryData(['employee-profile', 'employee-user-2', 2])).toBeUndefined();
});

it('does not apply an in-flight old-session photo response after switching accounts', async () => {
  let finish!: (value: typeof profile) => void;
  mockUpload.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { client, wrapper } = setup();
  const { result, rerender } = renderHook(() => useUploadEmployeeAvatar(), { wrapper });
  let pending!: Promise<unknown>;
  await act(async () => { pending = result.current.mutateAsync(image); });
  mockEpoch += 1;
  mockUser = { id: 'employee-user-2', email: 'second@example.com' };
  rerender({});
  await act(async () => { finish(profile); await expect(pending).rejects.toThrow('Session changed'); });
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(client.getQueryData(['employee-profile', 'employee-user-2', 2])).toBeUndefined();
});

it('updates the owning account and its cache after a successful photo save', async () => {
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useUploadEmployeeAvatar(), { wrapper });
  await act(async () => { await result.current.mutateAsync(image); });
  expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ id: 'employee-user-1', avatarUrl: '/new.png' }) }));
  expect(client.getQueryData(['employee-profile', 'employee-user-1', 1])).toEqual(profile);
});

it('rejects a retained contact request before sending a code from a replacement account', async () => {
  const { wrapper } = setup();
  const { result, rerender } = renderHook(() => useRequestEmployeeContact(), { wrapper });
  const retainedRequest = result.current.mutateAsync;
  mockEpoch += 1;
  mockUser = { id: 'employee-user-2', email: 'second@example.com' };
  rerender({});
  await act(async () => { await expect(retainedRequest({ channel: 'EMAIL', identifier: 'new@example.com' })).rejects.toThrow('Session changed'); });
  expect(mockRequest).not.toHaveBeenCalled();
});
