import api from './api';
import { SessionSupersededError, type VerifiedMobileOtpResponse } from './auth';
import { beginSession, isSessionCurrent, persistSessionTokensAtEpoch } from './native-session-state';

/** Customer credentials only. Phone canonicalization belongs to the backend's Saudi-aware parser. */
export async function loginWithPassword(identifier: string, password: string, onStarted?: (epoch: number) => void): Promise<VerifiedMobileOtpResponse> {
  const value = identifier.trim();
  const body = value.includes('@') ? { email: value.toLowerCase(), password } : { phone: value, password };
  const epoch = beginSession();
  onStarted?.(epoch);
  const { data } = await api.post<VerifiedMobileOtpResponse>('/mobile/auth/password-login', body);
  if (!isSessionCurrent(epoch)) throw new SessionSupersededError();
  if (data?.sessionKind !== 'client' || typeof data.tokens?.accessToken !== 'string' || !data.tokens.accessToken ||
      typeof data.tokens?.refreshToken !== 'string' || !data.tokens.refreshToken) throw new Error('Invalid client login response');
  const persisted = await persistSessionTokensAtEpoch(data.tokens, epoch);
  if (!persisted || !isSessionCurrent(epoch)) throw new SessionSupersededError();
  return { ...data, sessionEpoch: epoch };
}
