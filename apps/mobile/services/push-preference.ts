import { getSessionEpoch, isSessionCurrent } from './native-session-state';
import { clientProfileService } from './client/profile';
import { registerForPushAsync, unregisterPushAsync } from './push';

/** Do not advertise enabled delivery unless the device and server both agree. */
export async function updatePushPreference(enabled: boolean): Promise<void> {
  const epoch = getSessionEpoch();
  const current = () => isSessionCurrent(epoch);
  if (enabled && !(await registerForPushAsync(current))) {
    throw new Error('Push registration unavailable');
  }
  if (!current()) throw new Error('Session changed');
  try {
    await clientProfileService.updateProfile({ pushEnabled: enabled });
  } catch (error) {
    if (enabled && current()) await unregisterPushAsync();
    throw error;
  }
  if (!enabled && current()) await unregisterPushAsync();
  if (!current()) throw new Error('Session changed');
}
