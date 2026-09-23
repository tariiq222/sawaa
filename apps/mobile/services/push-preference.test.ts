jest.mock('./native-session-state', () => ({ getSessionEpoch: jest.fn(() => 1), isSessionCurrent: jest.fn(() => true) }));
import { isSessionCurrent } from './native-session-state';
jest.mock('./client/profile', () => ({ clientProfileService: { updateProfile: jest.fn() } }));
jest.mock('./push', () => ({ registerForPushAsync: jest.fn(), unregisterPushAsync: jest.fn() }));
import { clientProfileService } from './client/profile';
import { registerForPushAsync, unregisterPushAsync } from './push';
import { updatePushPreference } from './push-preference';
const register = registerForPushAsync as jest.Mock;
const unregister = unregisterPushAsync as jest.Mock;
const update = clientProfileService.updateProfile as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); (isSessionCurrent as jest.Mock).mockReturnValue(true); register.mockResolvedValue('fcm'); update.mockReset().mockResolvedValue({}); });
it('does not enable server preference when native registration is unavailable', async () => {
  register.mockResolvedValue(null);
  await expect(updatePushPreference(true)).rejects.toThrow();
  expect(update).not.toHaveBeenCalled();
});
it('rolls back this device registration if preference persistence fails', async () => {
  update.mockRejectedValue(new Error('offline'));
  await expect(updatePushPreference(true)).rejects.toThrow('offline');
  expect(unregister).toHaveBeenCalledTimes(1);
});
it('persists an enabled preference after registration succeeds', async () => {
  await updatePushPreference(true);
  expect(update).toHaveBeenCalledWith({ pushEnabled: true });
  expect(unregister).not.toHaveBeenCalled();
});
it('disables on server before unregistering this device', async () => {
  await updatePushPreference(false);
  expect(update).toHaveBeenCalledWith({ pushEnabled: false });
  expect(register).not.toHaveBeenCalled();
  expect(unregister).toHaveBeenCalledTimes(1);
});
it('preserves registration when disabling fails on server', async () => {
  update.mockRejectedValue(new Error('offline'));
  await expect(updatePushPreference(false)).rejects.toThrow('offline');
  expect(unregister).not.toHaveBeenCalled();
});

it('does not save preference or delete tokens for a newer session', async () => {
  register.mockImplementationOnce(async () => { (isSessionCurrent as jest.Mock).mockReturnValue(false); return 'fcm'; });
  await expect(updatePushPreference(true)).rejects.toThrow('Session changed');
  expect(update).not.toHaveBeenCalled();
  expect(unregister).not.toHaveBeenCalled();
});
it('rejects a late preference response instead of updating a newer account cache', async () => {
  update.mockImplementationOnce(async () => { (isSessionCurrent as jest.Mock).mockReturnValue(false); return {}; });
  await expect(updatePushPreference(false)).rejects.toThrow('Session changed');
  expect(unregister).not.toHaveBeenCalled();
});
