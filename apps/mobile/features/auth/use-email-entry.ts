import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppDispatch } from '@/hooks/use-redux';
import { clearSessionAtEpoch, fenceSession, getSessionEpoch, isSessionCurrent } from '@/services/native-session-state';
import { SessionSupersededError } from '@/services/auth';
import { emailEntryError, type EmailVerified, type PhoneDetails } from '@/services/email-entry';
import { authContinuationParams } from '@/features/booking/guest-booking-flow';
import { completeNativeSession, promoteEmailSession } from './complete-native-session';
import { emailEntryReducer, initialEmailEntryState } from './email-entry-state';
import { useEmailEntryMutations } from './email-entry-mutations';

type Context = { booking?: string; redirect?: string; initialEmail?: string; autoStart?: boolean; onExit?: () => void };
export function useEmailEntry(context: Context) {
  const [state, dispatch] = useReducer(emailEntryReducer, context.initialEmail ?? '', initialEmailEntryState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const autoStarted = useRef(false);
  const generation = useRef(0);
  const ownedSessionEpoch = useRef<number | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const router = useRouter();
  const appDispatch = useAppDispatch();
  const { execute, api } = useEmailEntryMutations();
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
  const restart = () => { invalidate(); dispatch({ type: 'restart' }); setPending(false); setError(''); };
  const exit = () => { restart(); if (context.onExit) context.onExit(); else router.back(); };
  const usePhone = () => {
    restart();
    if (context.onExit) context.onExit();
    else router.replace({ pathname: '/(auth)/login', params: authContinuationParams(context.booking, context.redirect) });
  };
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
      const recovery = emailEntryError(failure);
      setError(recovery.key);
      if (recovery.retryAfterSeconds) {
        dispatch({ type: 'retry', retryAt: Date.now() + recovery.retryAfterSeconds * 1000 });
      }
      dispatch({ type: 'code', value: '' });
    } finally {
      if (current()) { busy.current = false; setPending(false); }
    }
  };
  const handleResult = async (result: EmailVerified, current: () => boolean, epoch: number) => {
    if (!current() || !isSessionCurrent(epoch)) return;
    if (result.next !== 'authenticated') {
      dispatch({ type: 'verified', result, now: Date.now() }); return;
    }
    const verified = await promoteEmailSession(result, epoch, current, value => { ownedSessionEpoch.current = value; });
    await completeNativeSession(verified, { dispatch: appDispatch, replace: router.replace, ...context, isFlowCurrent: current, onReady: () => { ownedSessionEpoch.current = null; } });
    if (current()) dispatch({ type: 'restart' });
  };
  const requestEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) { setError('invalidEmail'); return; }
    if (Date.now() < state.retryAt) return;
    return run(async (current, epoch) => {
      const result = await api.request({ email: state.email.trim() });
      if (current() && isSessionCurrent(epoch)) dispatch({ type: 'emailChallenge', result, now: Date.now() });
    });
  };
  useEffect(() => {
    if (!context.autoStart || autoStarted.current) return;
    const timer = setTimeout(() => { autoStarted.current = true; void requestEmail(); }, 0);
    return () => clearTimeout(timer);
  });
  const verify = () => {
    if (state.code.length !== 6 || Date.now() >= state.expiresAt) return;
    return run(async (current, epoch) => {
      const result = state.step === 'phone_code'
        ? await api.verifyPhone({ phoneChallengeId: state.phoneChallengeId, continuationToken: state.continuationToken, code: state.code })
        : await api.verify({ challengeId: state.challengeId, code: state.code });
      await handleResult(result, current, epoch);
    });
  };
  const requestPhone = (details: PhoneDetails) => {
    if (Date.now() >= state.flowExpiresAt) { setError('expiredFlow'); return; }
    if (Date.now() < state.retryAt) return;
    return run(async (current, epoch) => {
      const result = await api.requestPhone({ ...details, continuationToken: state.continuationToken });
      if (current() && isSessionCurrent(epoch)) dispatch({ type: 'phoneChallenge', result, now: Date.now() });
    });
  };
  const resend = () => {
    if (Date.now() < state.retryAt) return;
    if (state.step === 'email_code') return requestEmail();
    if (Date.now() >= state.flowExpiresAt) { setError('expiredFlow'); return; }
    return run(async (current, epoch) => {
      const result = await api.resendPhone({ phoneChallengeId: state.phoneChallengeId, continuationToken: state.continuationToken });
      if (current() && isSessionCurrent(epoch)) dispatch({ type: 'phoneChallenge', result, now: Date.now() });
    });
  };
  return { state, pending, error, requestEmail, verify, requestPhone, resend, restart, exit, usePhone,
    setEmail: (value: string) => { invalidate(); dispatch({ type: 'email', value }); setError(''); },
    setCode: (value: string) => dispatch({ type: 'code', value }),
    retrySeconds: Math.max(0, Math.ceil((state.retryAt - now) / 1000)),
    expired: state.expiresAt > 0 && now >= state.expiresAt,
    flowExpired: state.flowExpiresAt > 0 && now >= state.flowExpiresAt,
  };
}
