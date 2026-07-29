'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { getConsent } from '@/components/consent/cookie-consent-banner';

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || 'sawaa.sa';
const PLAUSIBLE_HOST = process.env.NEXT_PUBLIC_PLAUSIBLE_HOST || 'https://plausible.io';

// useSyncExternalStore contract: subscribe/getServerSnapshot are
// defined at module scope so React can call them during SSR without
// re-allocating each render.
function subscribe(notify: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('sawaa-consent', notify)
  return () => window.removeEventListener('sawaa-consent', notify)
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return getConsent()?.decision === 'all'
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * Loads Plausible Analytics ONLY after the user has opted in via
 * the cookie consent banner. Plausible is privacy-friendly:
 *  - no cookies (cookie-less analytics)
 *  - no personal data collection
 *  - no cross-site tracking
 *  - hashes the IP address
 * So even if/when regulations change, the load guard here is the
 * belt-and-braces enforcement of the PDPL "no analytics without
 * consent" rule.
 *
 * If NEXT_PUBLIC_PLAUSIBLE_DOMAIN is not set, the loader is a no-op
 * (analytics disabled by config, not by user).
 */
export function AnalyticsLoader() {
  const hasConsent = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  if (!hasConsent || !PLAUSIBLE_DOMAIN) return null

  return (
    <Script
      defer
      data-domain={PLAUSIBLE_DOMAIN}
      src={`${PLAUSIBLE_HOST}/js/script.js`}
      strategy="afterInteractive"
    />
  )
}