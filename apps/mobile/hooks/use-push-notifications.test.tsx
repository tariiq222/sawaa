import { renderHook } from '@testing-library/react-native';
jest.mock('@/services/push', () => ({ registerForPushAsync: jest.fn().mockResolvedValue('fcm'), unregisterPushAsync: jest.fn(), subscribeToFcmTokenRefresh: jest.fn() }));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: jest.fn(() => 1), isSessionCurrent: jest.fn(() => true) }));
import { registerForPushAsync, unregisterPushAsync, subscribeToFcmTokenRefresh } from '@/services/push';
import { isSessionCurrent } from '@/services/native-session-state';
import { usePushNotifications } from './use-push-notifications';
const stop = jest.fn();
beforeEach(() => { jest.clearAllMocks(); (isSessionCurrent as jest.Mock).mockReturnValue(true); (subscribeToFcmTokenRefresh as jest.Mock).mockReturnValue(stop); });
it('does not register without a client identity or with disabled preference', () => {
  const { rerender } = renderHook<void, { id: string | null; enabled: boolean }>(({ id, enabled }) => usePushNotifications(id, enabled), { initialProps: { id: null as string | null, enabled: true } });
  rerender({ id: 'client-a', enabled: false });
  expect(registerForPushAsync).not.toHaveBeenCalled();
});
it('owns one registration and disposes refresh on cleanup', () => {
  const { unmount } = renderHook(() => usePushNotifications('client-a', true));
  expect(registerForPushAsync).toHaveBeenCalledTimes(1);
  const current = (registerForPushAsync as jest.Mock).mock.calls[0][0];
  expect(current()).toBe(true);
  unmount();
  expect(current()).toBe(false);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(unregisterPushAsync).toHaveBeenCalledTimes(1);
});
it('does not unregister with a newer session credentials', () => {
  const { unmount } = renderHook(() => usePushNotifications('client-a', true));
  (isSessionCurrent as jest.Mock).mockReturnValue(false);
  unmount();
  expect(unregisterPushAsync).not.toHaveBeenCalled();
});
it('registers token refresh only while the session remains current', () => {
  renderHook(() => usePushNotifications('client-a', true));
  const refresh = (subscribeToFcmTokenRefresh as jest.Mock).mock.calls[0][0];
  refresh('new-fcm');
  expect(registerForPushAsync).toHaveBeenCalledTimes(2);
});
