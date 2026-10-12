import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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
} from '@/features/auth/client-email-prompt';
import {
  CLIENT_EMAIL_PROMPT_SNOOZE_MS,
  isClientEmailPromptSnoozed,
  resetClientEmailSnoozeForTests,
  snoozeClientEmailPrompt,
} from '@/features/auth/client-email-snooze';

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockAuthState.token = 'token';
  mockAuthState.user = { id: 'client-1', role: 'CLIENT', isSuperAdmin: false };
  mockStatusData = { prompt: true };
  resetClientEmailPromptStateForTests();
  resetClientEmailSnoozeForTests();
});

it('pushes the prompt screen once when a client needs an email', async () => {
  renderHook(() => useClientEmailPrompt());
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(client)/email-verify', params: { mode: 'prompt' } });
});

it('never pushes while the prompt is snoozed for this user', async () => {
  await snoozeClientEmailPrompt('client-1');
  renderHook(() => useClientEmailPrompt());
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(mockPush).not.toHaveBeenCalled();
});

it('keeps the snooze across a cold start (memory cleared, storage kept)', async () => {
  await snoozeClientEmailPrompt('client-1');
  resetClientEmailSnoozeForTests();
  renderHook(() => useClientEmailPrompt());
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(mockPush).not.toHaveBeenCalled();
});

it('does not apply one user\'s snooze to another user', async () => {
  await snoozeClientEmailPrompt('someone-else');
  renderHook(() => useClientEmailPrompt());
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
});

it('expires the snooze after 7 days', async () => {
  const now = Date.now();
  await snoozeClientEmailPrompt('client-1', now);
  resetClientEmailSnoozeForTests();
  expect(await isClientEmailPromptSnoozed('client-1', now + CLIENT_EMAIL_PROMPT_SNOOZE_MS - 1)).toBe(true);
  expect(await isClientEmailPromptSnoozed('client-1', now + CLIENT_EMAIL_PROMPT_SNOOZE_MS + 1)).toBe(false);
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
