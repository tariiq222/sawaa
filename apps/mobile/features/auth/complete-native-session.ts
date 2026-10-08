import type { Router } from 'expo-router';
import type { AppDispatch } from '@/stores/store';
import { authService, SessionSupersededError, type VerifiedMobileOtpResponse } from '@/services/auth';
import { beginSession, isSessionCurrent, persistSessionTokensAtEpoch } from '@/services/native-session-state';
import { setCredentials } from '@/stores/slices/auth-slice';
import { decodeBookingReturn } from '@/features/booking/guest-booking-flow';
import { decodeRedirect } from '@/lib/navigation';
import type { NativeSession } from '@/services/email-entry';

type CompletionContext = {
  dispatch: AppDispatch; replace: Router['replace'];
  booking?: string | string[]; redirect?: string | string[];
  isFlowCurrent?: () => boolean;
  onReady?: () => void;
};
export async function promoteEmailSession(result: NativeSession, capturedEpoch: number, isFlowCurrent: () => boolean, onPromoted?: (epoch: number) => void) {
  // Check BEFORE beginSession: an old response must never fence a newer login.
  if (!isSessionCurrent(capturedEpoch) || !isFlowCurrent()) throw new SessionSupersededError();
  const sessionEpoch = beginSession();
  onPromoted?.(sessionEpoch);
  const persisted = await persistSessionTokensAtEpoch(result.tokens, sessionEpoch);
  if (!persisted || !isSessionCurrent(sessionEpoch) || !isFlowCurrent()) throw new SessionSupersededError();
  return { ...result, sessionEpoch };
}
export async function completeNativeSession(result: VerifiedMobileOtpResponse, context: CompletionContext) {
  const current = () => isSessionCurrent(result.sessionEpoch) && (context.isFlowCurrent?.() ?? true);
  if (!current()) throw new SessionSupersededError();
  const profileResult = await authService.getProfile(result.sessionKind);
  if (!current()) throw new SessionSupersededError();
  const profile = profileResult.success && profileResult.data;
  if (!profile || (result.sessionKind === 'client' && profile.role !== 'CLIENT')) throw new Error('Authenticated profile unavailable');
  context.onReady?.();
  context.dispatch(setCredentials({ ...result.tokens, user: profile }));
  const kind = result.sessionKind ?? 'client';
  const booking = kind === 'client' ? decodeBookingReturn(Array.isArray(context.booking) ? context.booking[0] : context.booking) : null;
  if (booking) {
    const { amount, ...selection } = booking;
    context.replace({ pathname: '/(client)/booking/confirm', params: { ...selection, chargedPrice: amount } });
    return;
  }
  const candidate = Array.isArray(context.redirect) ? context.redirect[0] : context.redirect;
  const group = (candidate?.split(/[?#]/, 1)[0] ?? '').split('/')[1];
  const matches = kind === 'staff' ? group === '(employee)' : group !== '(employee)';
  const redirect = matches ? decodeRedirect(context.redirect) : null;
  context.replace(redirect ?? (kind === 'staff' ? '/(employee)/(tabs)/today' : '/(client)/(tabs)/home'));
}
