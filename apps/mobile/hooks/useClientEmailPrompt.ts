import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';
import { useClientEmailStatus } from '@/hooks/queries';
import { isAuthContinuationActive } from '@/features/auth/client-email-prompt';
import { isClientEmailPromptSnoozed } from '@/features/auth/client-email-snooze';

/**
 * One-time, per-app-session prompt on the client home tab: when a signed-in
 * client still has an unresolved unverified email, offer the add-email screen
 * once — never while snoozed ("later", 7 days per user) or while an auth
 * booking/redirect continuation is mid-flight.
 */
export function useClientEmailPrompt() {
  const { token, user } = useAppSelector((state) => state.auth);
  const isClient = Boolean(token && user && getPrimaryRole(user) === 'client');
  const status = useClientEmailStatus();
  const router = useRouter();
  const prompted = useRef(false);
  const prompt = status.data?.prompt === true;
  const userId = user?.id;
  useEffect(() => {
    if (!isClient || !userId || prompted.current || !prompt) return;
    let active = true;
    void isClientEmailPromptSnoozed(userId).then((snoozed) => {
      if (!active || snoozed || prompted.current || isAuthContinuationActive()) return;
      prompted.current = true;
      router.push({ pathname: '/(client)/email-verify', params: { mode: 'prompt' } });
    });
    return () => { active = false; };
  }, [isClient, userId, prompt, router]);
}
