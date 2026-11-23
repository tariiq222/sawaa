'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { CookieConsentBanner, getConsent } from '@/components/consent/cookie-consent-banner';
import { isPublicAnalyticsPage } from '@/lib/analytics/public-pages';

function subscribe(notify: () => void) {
  window.addEventListener('sawaa-consent', notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener('sawaa-consent', notify);
    window.removeEventListener('storage', notify);
  };
}

function getSnapshot() {
  const consent = getConsent();
  return consent?.decision === 'all' && consent.googleAnalytics === true;
}

function getServerSnapshot() {
  return false;
}

const SESSION_KEY = 'sawaa-analytics-session';

type AnalyticsSession = { client: string; id: number; lastView: number };

function getSession(): AnalyticsSession | null {
  const now = Math.floor(Date.now() / 1000);
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    const previous = saved ? JSON.parse(saved) as Partial<AnalyticsSession> | null : null;
    const session = typeof previous?.client === 'string'
      && typeof previous.id === 'number'
      && typeof previous.lastView === 'number'
      && previous.lastView <= now
      && now - previous.lastView < 30 * 60
      ? { client: previous.client, id: previous.id, lastView: now }
      : { client: crypto.randomUUID(), id: now, lastView: now };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

export function GoogleAnalytics() {
  const page = usePathname();
  const allowed = isPublicAnalyticsPage(page);
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const previousPage = useRef<string | null>(null);

  useEffect(() => {
    if (!consent || !allowed) {
      previousPage.current = null;
      return;
    }
    if (page === previousPage.current) return;

    const session = getSession();
    if (!session) return;

    previousPage.current = page;
    void fetch('/api/site-analytics', {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      headers: {
        'x-sawaa-analytics-page': page,
        'x-sawaa-analytics-client': session.client,
        'x-sawaa-analytics-session': String(session.id),
      },
    }).catch(() => {
      // A blocked or unavailable analytics endpoint must never affect navigation.
    });
  }, [allowed, consent, page]);

  return allowed ? <CookieConsentBanner includeGoogleAnalytics /> : null;
}
