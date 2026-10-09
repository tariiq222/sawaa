import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppDispatch } from '@/hooks/use-redux';
import { clearSessionAtEpoch, fenceSession, getSessionEpoch, isSessionCurrent } from '@/services/native-session-state';
import { SessionSupersededError } from '@/services/auth';
import { phoneEntryError, type PhoneRegistrationDetails } from '@/services/phone-entry';
import { normalizeSaudiMobile } from '@/lib/phone-format';
import { authContinuationParams } from '@/features/booking/guest-booking-flow';
import { beginAuthContinuation, endAuthContinuation } from './client-email-prompt';
import { completeNativeSession, promoteEmailSession } from './complete-native-session';
import { initialPhoneEntryState, phoneEntryReducer } from './phone-entry-state';
import { usePhoneEntryMutations } from './phone-entry-mutations';

type Context = { booking?: string; redirect?: string };

/**
 * In-memory phone-entry state machine, mirroring use-email-entry's safety
 * model: challenge/continuation secrets live only in reducer state (never in
 * route params, storage or logs), a generation counter discards late
 * responses, and session epoch fencing stops an old flow from promoting or
 * clearing a newer login. The flow restarts on blur/exit.
 */
export function usePhoneEntry(context: Context) {
  const [state, dispatch] = useReducer(phoneEntryReducer, initialPhoneEntryState());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  const ownedSessionEpoch = useRef<number | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const router = useRouter();
  const appDispatch = useAppDispatch();
  const { execute, api } = usePhoneEntryMutations();
  const invalidate = useCallback(() => {
    generation.current++; busy.current = false;
    // Cancel only the session this flow is still completing. A newer login
    // owns a different epoch and must never be cleared by this screen.
    if (ownedSessionEpoch.current !== null && isSessionCurrent(ownedSessionEpoch.current)) {
      void clearSessionAtEpoch(fenceSession()).catch(() => undefined);
    }
    ownedSessionEpoch.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; invalidate(); clearInterval(timer); };
  }, [invalidate]);
  useFocusEffect(useCallback(() => () => {
    invalidate(); dispatch({ type: 'restart' }); setPending(false); setError('');
  }, [invalidate]));
  // A booking/redirect continuation owns this visit; suppress the one-time
  // email prompt until the session completes and lands the user's target.
  useEffect(() => {
    if (!context.booking && !context.redirect) return;
    beginAuthContinuation();
    return endAuthContinuation;
  }, [context.booking, context.redirect]);
  const restart = () => { invalidate(); dispatch({ type: 'restart' }); setPending(false); setError(''); };
  const run = async (operation: (current: () => boolean, epoch: number) => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    const capturedGeneration = generation.current;
    const epoch = getSessionEpoch();
    const current = () => mounted.current && generation.current === capturedGeneration;
    try {
      await execute(async () => { await operation(current, epoch); });
    } catch (failure) {
      if (!current() || failure instanceof SessionSupersededError ||
        (!isSessionCurrent(epoch) && ownedSessionEpoch.current !== getSessionEpoch())) return;
      const recovery = phoneEntryError(failure);
      setError(recovery.key);
      if (recovery.retryAfterSeconds) {
        dispatch({ type: 'retry', retryAt: Date.now() + recovery.retryAfterSeconds * 1000 });
      }
      dispatch({ type: 'code', value: '' });
    } finally {
      if (current()) { busy.current = false; setPending(false); }
    }
  };
  const handleAuthenticated = async (
    result: { tokens: { accessToken: string; refreshToken: string }; sessionKind: 'client' | 'staff' },
    current: () => boolean, epoch: number,
  ) => {
    const verified = await promoteEmailSession(result, epoch, current, value => { ownedSessionEpoch.current = value; });
    await completeNativeSession(verified, { dispatch: appDispatch, replace: router.replace, ...context, isFlowCurrent: current, onReady: () => { ownedSessionEpoch.current = null; } });
    if (current()) dispatch({ type: 'restart' });
  };
  const request = () => {
    const normalized = normalizeSaudiMobile(state.phone);
    if (!normalized) { setError('invalidPhone'); return; }
    if (Date.now() < state.retryAt) return;
    return run(async (current, epoch) => {
      const result = await api.request({ phone: normalized });
      if (current() && isSessionCurrent(epoch)) dispatch({ type: 'challenge', result, now: Date.now() });
    });
  };
  const resend = () => {
    if (Date.now() < state.retryAt) return;
    return run(async (current, epoch) => {
      const result = await api.resend({ challengeId: state.challengeId });
      if (current() && isSessionCurrent(epoch)) dispatch({ type: 'challenge', result, now: Date.now() });
    });
  };
  const verify = () => {
    if (state.code.length !== 6 || Date.now() >= state.expiresAt) return;
    return run(async (current, epoch) => {
      const result = await api.verify({ challengeId: state.challengeId, code: state.code });
      if (!current() || !isSessionCurrent(epoch)) return;
      if (result.next !== 'authenticated') { dispatch({ type: 'verified', result, now: Date.now() }); return; }
      await handleAuthenticated(result, current, epoch);
    });
  };
  const complete = (details: Omit<PhoneRegistrationDetails, 'continuationToken'>) => {
    if (Date.now() >= state.flowExpiresAt) { setError('expiredFlow'); return; }
    return run(async (current, epoch) => {
      const result = await api.complete({ ...details, continuationToken: state.continuationToken });
      if (!current() || !isSessionCurrent(epoch)) return;
      await handleAuthenticated(result, current, epoch);
    });
  };
  const continuation = authContinuationParams(context.booking, context.redirect);
  return {
    state, pending, error, request, verify, resend, complete, restart,
    changePhone: () => { invalidate(); dispatch({ type: 'editPhone' }); setPending(false); setError(''); },
    setPhone: (value: string) => { invalidate(); dispatch({ type: 'phone', value }); setError(''); },
    setCode: (value: string) => dispatch({ type: 'code', value }),
    retrySeconds: Math.max(0, Math.ceil((state.retryAt - now) / 1000)),
    expired: state.expiresAt > 0 && now >= state.expiresAt,
    flowExpired: state.flowExpiresAt > 0 && now >= state.flowExpiresAt,
    emailEntryHref: context.booking || context.redirect
      ? { pathname: '/(auth)/email-entry' as const, params: continuation }
      : '/(auth)/email-entry',
  };
}
