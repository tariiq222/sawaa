import { act, renderHook } from '@testing-library/react-native';
jest.mock('expo-notifications', () => ({ addNotificationResponseReceivedListener: jest.fn(), getLastNotificationResponseAsync: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: jest.fn(() => 1), isSessionCurrent: jest.fn(() => true) }));
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { isSessionCurrent } from '@/services/native-session-state';
import { usePushResponses } from './use-push-responses';
const remove = jest.fn();
function responseWith(data: Record<string, unknown>, identifier = 'notification-1') {
  return { notification: { request: { identifier, content: { data } } } };
}
const response = responseWith({ url: 'https://untrusted.example' });
function tapFirst(response: unknown) {
  const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
  return act(async () => { listener(response); });
}
beforeEach(() => { jest.clearAllMocks(); (isSessionCurrent as jest.Mock).mockReturnValue(true); (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove }); (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null); });
it('does not listen for staff or unauthenticated sessions', () => {
  renderHook(() => usePushResponses(null));
  expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
});
it('opens the notification list for a payload with no actionable target, deduplicates taps and removes listener', async () => {
  const { unmount } = renderHook(() => usePushResponses('c1'));
  const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];
  await act(async () => { listener(response); listener(response); });
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith('/(client)/notifications');
  unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
it('opens the exact appointment when the payload carries a booking id', async () => {
  renderHook(() => usePushResponses('c1'));
  await tapFirst(responseWith({ notificationType: 'BOOKING_REMINDER', bookingId: 'b-7' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/(client)/appointment/[id]', params: { id: 'b-7' } });
});
it('opens the appointments tab for a booking type without an id', async () => {
  renderHook(() => usePushResponses('c1'));
  await tapFirst(responseWith({ notificationType: 'BOOKING_CANCELLED' }));
  expect(router.push).toHaveBeenCalledWith('/(client)/(tabs)/appointments');
});
it('opens the notifications list for a conversation-scoped payload', async () => {
  renderHook(() => usePushResponses('c1'));
  await tapFirst(responseWith({ conversationId: 'c-2' }));
  expect(router.push).toHaveBeenCalledWith('/(client)/notifications');
});
it('never navigates to a URL or malformed id supplied by the payload', async () => {
  renderHook(() => usePushResponses('c1'));
  await tapFirst(responseWith({ url: 'https://untrusted.example', bookingId: '../evil' }));
  expect(router.push).toHaveBeenCalledWith('/(client)/notifications');
});
it('ignores a late cold-start response after switching sessions', async () => {
  let resolve!: (value: unknown) => void;
  (Notifications.getLastNotificationResponseAsync as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
  renderHook(() => usePushResponses('c1'));
  (isSessionCurrent as jest.Mock).mockReturnValue(false);
  await act(async () => { resolve(response); });
  expect(router.push).not.toHaveBeenCalled();
});
