import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppDispatch } from '@/hooks/use-redux';
import { loginWithPassword } from '@/services/password-login';
import { SessionSupersededError } from '@/services/auth';
import { clearSessionAtEpoch, fenceSession, isSessionCurrent } from '@/services/native-session-state';
import { completeNativeSession } from './complete-native-session';

export function usePasswordLogin(context: { booking?: string; redirect?: string }) {
  const dispatch = useAppDispatch(); const router = useRouter();
  const [pending, setPending] = useState(false);
  const generation = useRef(0); const ownedEpoch = useRef<number | null>(null); const busy = useRef(false);
  const cancel = useCallback(() => {
    generation.current++; busy.current = false;
    if (ownedEpoch.current !== null && isSessionCurrent(ownedEpoch.current)) {
      void clearSessionAtEpoch(fenceSession()).catch(() => undefined);
    }
    ownedEpoch.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  useFocusEffect(useCallback(() => () => { cancel(); setPending(false); }, [cancel]));
  const capture = () => { const value = generation.current; return () => value === generation.current; };
  const submit = async (identifier: string, password: string): Promise<'failed' | 'complete' | 'cancelled'> => {
    if (busy.current) return 'cancelled';
    busy.current = true; setPending(true); const current = capture();
    try {
      const result = await loginWithPassword(identifier, password, epoch => { ownedEpoch.current = epoch; });
      await completeNativeSession(result, { dispatch, replace: router.replace, ...context, isFlowCurrent: current, onReady: () => { ownedEpoch.current = null; } });
      return 'complete';
    } catch (error) {
      if (!current() || error instanceof SessionSupersededError || (ownedEpoch.current !== null && !isSessionCurrent(ownedEpoch.current))) return 'cancelled';
      if (ownedEpoch.current !== null) await clearSessionAtEpoch(ownedEpoch.current);
      return current() ? 'failed' : 'cancelled';
    } finally {
      if (current()) { ownedEpoch.current = null; busy.current = false; setPending(false); }
    }
  };
  return { pending, submit, capture, cancel: () => { cancel(); setPending(false); } };
}
