import { renderHook, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const mockAuthState = { token: 'token' as string | null, user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: false } as object | null };
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (select: (state: unknown) => unknown) => select({ auth: mockAuthState }),
}));
let mockStatusData: { prompt: boolean } | undefined = { prompt: true };
jest.mock('@/hooks/queries', () => ({
  useClientEmailStatus: () => ({ data: mockStatusData }),
}));

import { useClientEmailPrompt } from '@/hooks/useClientEmailPrompt';
import {
  beginAuthContinuation,
  endAuthContinuation,
  resetClientEmailPromptStateForTests,
  snoozeClientEmailPromptForSession,
} from '@/features/auth/client-email-prompt';

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState.token = 'token';
  mockAuthState.user = { id: 'client-1', role: 'CLIENT', isSuperAdmin: false };
  mockStatusData = { prompt: true };
  resetClientEmailPromptStateForTests();
});

it('pushes the prompt screen once when a client needs an email', async () => {
  renderHook(() => useClientEmailPrompt());
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(client)/email-verify', params: { mode: 'prompt' } });
});

it('never pushes while the prompt is snoozed for this app session', async () => {
  snoozeClientEmailPromptForSession();
  renderHook(() => useClientEmailPrompt());
  await waitFor(() => expect(mockPush).not.toHaveBeenCalled());
});

it('never pushes while an auth continuation is active', async () => {
  beginAuthContinuation();
  renderHook(() => useClientEmailPrompt());
  await waitFor(() => expect(mockPush).not.toHaveBeenCalled());
  endAuthContinuation();
});

it('stays quiet for clients without a pending prompt', async () => {
  mockStatusData = { prompt: false };
  renderHook(() => useClientEmailPrompt());
  await waitFor(() => expect(mockPush).not.toHaveBeenCalled());
});

it('stays quiet for signed-out visitors', async () => {
  mockAuthState.token = null;
  mockAuthState.user = null;
  renderHook(() => useClientEmailPrompt());
  await waitFor(() => expect(mockPush).not.toHaveBeenCalled());
});
