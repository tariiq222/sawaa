import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';
import { useClientEmailStatus } from '@/hooks/queries';
import { isAuthContinuationActive, isClientEmailPromptSnoozed } from '@/features/auth/client-email-prompt';

/**
 * One-time, per-app-session prompt on the client home tab: when a signed-in
 * client still has an unresolved unverified email, offer the add-email screen
 * once — never while snoozed ("later") or while an auth booking/redirect
 * continuation is mid-flight.
 */
export function useClientEmailPrompt() {
  const { token, user } = useAppSelector((state) => state.auth);
  const isClient = Boolean(token && user && getPrimaryRole(user) === 'client');
  const status = useClientEmailStatus();
  const router = useRouter();
  const prompted = useRef(false);
  const prompt = status.data?.prompt === true;
  useEffect(() => {
    if (!isClient || prompted.current || !prompt) return;
    if (isClientEmailPromptSnoozed() || isAuthContinuationActive()) return;
    prompted.current = true;
    router.push({ pathname: '/(client)/email-verify', params: { mode: 'prompt' } });
  }, [isClient, prompt, router]);
}
