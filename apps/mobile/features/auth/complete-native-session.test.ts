import { completeNativeSession, promoteEmailSession } from './complete-native-session';
import { authService } from '@/services/auth';
import { beginSession, persistSessionTokensAtEpoch } from '@/services/native-session-state';
let mockEpoch = 3;
jest.mock('@/services/native-session-state', () => ({
  getSessionEpoch: () => mockEpoch,
  isSessionCurrent: (epoch: number) => epoch === mockEpoch,
  beginSession: jest.fn(() => ++mockEpoch),
  persistSessionTokensAtEpoch: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/services/auth', () => ({ authService: { getProfile: jest.fn() }, SessionSupersededError: class extends Error {} }));
const session = { tokens: { accessToken: 'a', refreshToken: 'r' }, sessionKind: 'client' as const };
beforeEach(() => { jest.clearAllMocks(); mockEpoch = 3; });
it('rejects a response captured before a newer session without starting or persisting a session', async () => {
  await expect(promoteEmailSession(session, 2, () => true)).rejects.toThrow();
  expect(beginSession).not.toHaveBeenCalled();
  expect(persistSessionTokensAtEpoch).not.toHaveBeenCalled();
});
it('rejects a cancelled generation before starting a session', async () => {
  await expect(promoteEmailSession(session, 3, () => false)).rejects.toThrow();
  expect(beginSession).not.toHaveBeenCalled();
});
it('waits for the profile and suppresses completion after a newer epoch', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof authService.getProfile>>) => void;
  jest.mocked(authService.getProfile).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const dispatch = jest.fn(); const replace = jest.fn();
  const pending = completeNativeSession({ ...session, sessionEpoch: 3 }, { dispatch, replace });
  mockEpoch = 4;
  resolve({ success: true, data: { id: 'u', role: 'CLIENT', email: '', name: '', firstName: '', lastName: '', phone: null, gender: null, avatarUrl: null, isActive: true, isSuperAdmin: false, permissions: [] } });
  await expect(pending).rejects.toThrow();
  expect(dispatch).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
});
it('hands off its new epoch before asynchronous persistence so cancellation can fence it', async () => {
  const promoted = jest.fn();
  let resolve!: (value: boolean) => void;
  jest.mocked(persistSessionTokensAtEpoch).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const pending = promoteEmailSession(session, 3, () => true, promoted);
  expect(promoted).toHaveBeenCalledWith(4);
  resolve(true);
  await pending;
});

it('routes a server-selected staff session to employee home rather than a client continuation', async () => {
  jest.mocked(authService.getProfile).mockResolvedValueOnce({ success: true, data: { role: 'EMPLOYEE' } } as Awaited<ReturnType<typeof authService.getProfile>>);
  const dispatch = jest.fn(); const replace = jest.fn();
  await completeNativeSession({ ...session, sessionKind: 'staff', sessionEpoch: 3 }, {
    dispatch, replace, redirect: '/(client)/(tabs)/home',
  });
  expect(authService.getProfile).toHaveBeenCalledWith('staff');
  expect(dispatch).toHaveBeenCalled();
  expect(replace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
});

it('rejects a staff profile for an explicit client response', async () => {
  jest.mocked(authService.getProfile).mockResolvedValueOnce({ success: true, data: { role: 'ADMIN' } } as Awaited<ReturnType<typeof authService.getProfile>>);
  const dispatch = jest.fn(); const replace = jest.fn();
  await expect(completeNativeSession({ ...session, sessionEpoch: 3 }, { dispatch, replace })).rejects.toThrow();
  expect(dispatch).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
});
