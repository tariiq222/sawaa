import { act, renderHook } from '@testing-library/react-native';
jest.mock('expo-notifications', () => ({ addNotificationResponseReceivedListener: jest.fn(), getLastNotificationResponseAsync: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: jest.fn(() => 1), isSessionCurrent: jest.fn(() => true) }));
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { isSessionCurrent } from '@/services/native-session-state';
import { usePushResponses } from './use-push-responses';
const remove = jest.fn();
const response = { notification: { request: { identifier: 'notification-1', content: { data: { url: 'https://untrusted.example' } } } } };
beforeEach(() => { jest.clearAllMocks(); (isSessionCurrent as jest.Mock).mockReturnValue(true); (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove }); (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null); });
it('does not listen for staff or unauthenticated sessions', () => {
  renderHook(() => usePushResponses(null));
  expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
});
it('opens only the authenticated notification list, deduplicates taps and removes listener', async () => {
  const { unmount } = renderHook(() => usePushResponses('c1'));
  const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
  await act(async () => { listener(response); listener(response); });
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith('/(client)/notifications');
  unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
it('ignores a late cold-start response after switching sessions', async () => {
  let resolve!: (value: unknown) => void;
  (Notifications.getLastNotificationResponseAsync as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
  renderHook(() => usePushResponses('c1'));
  (isSessionCurrent as jest.Mock).mockReturnValue(false);
  await act(async () => { resolve(response); });
  expect(router.push).not.toHaveBeenCalled();
});
