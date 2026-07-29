'use client';

import { useEffect, useState } from 'react';
import { useT, useLocale } from '@/features/locale/locale-provider';
import { localeDir } from '@/features/locale/locale';
import type { MessageKey } from '@/features/locale/dictionary';

type ConsentValue = 'all' | 'essential' | 'declined';

const STORAGE_KEY = 'sawaa-consent';

interface ConsentState {
  // 'all'    = all categories on (analytics included)
  // 'essential' = only essential, analytics off
  // 'declined' = no categories (treat essential as on, but the user
  //              explicitly rejected analytics — useful for analytics-
  //              only features that depend on user permission)
  decision: ConsentValue;
  decidedAt: string; // ISO timestamp
}

function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.decision && parsed.decidedAt) return parsed as ConsentState;
    return null;
  } catch {
    return null;
  }
}

function writeConsent(decision: ConsentValue): void {
  if (typeof window === 'undefined') return;
  const value: ConsentState = {
    decision,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    // Dispatch a custom event so other components (e.g. analytics
    // loaders) can react to the new decision without a global state
    // library.
    window.dispatchEvent(new CustomEvent('sawaa-consent', { detail: value }));
  } catch {
    // localStorage may be unavailable (private mode / quota). Fail
    // closed: treat as 'essential' so the banner stays visible.
  }
}

/**
 * Read the current consent decision. Returns null if the user has not
 * decided yet. Safe to call from SSR (returns null on the server).
 */
export function getConsent(): ConsentState | null {
  return readConsent();
}

export function hasAnalyticsConsent(): boolean {
  const c = readConsent();
  return c?.decision === 'all';
}

/**
 * One-shot banner shown on the first visit and on every visit until
 * the user makes a decision. The decision persists in localStorage
 * (no cookie), so the banner doesn't add a third-party cookie.
 */
export function CookieConsentBanner() {
  const t = useT();
  const locale = useLocale();
  const dir = localeDir(locale);
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (readConsent() === null) {
      // Defer to next tick so the banner doesn't pop in before paint
      // (also avoids a hydration flash on first load).
      const id = window.setTimeout(() => setOpen(true), 200);
      return () => window.clearTimeout(id);
    }
  }, []);

  if (!open) return null;

  const handleAccept = () => {
    writeConsent('all');
    setOpen(false);
  };
  const handleEssential = () => {
    writeConsent('essential');
    setOpen(false);
  };
  const handleDecline = () => {
    writeConsent('declined');
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('consent.title' as MessageKey)}
      dir={dir}
      style={{
        position: 'fixed',
        // bottom on LTR, top on RTL (banner stays readable in both)
        [dir === 'rtl' ? 'top' : 'bottom']: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'rgba(15, 23, 42, 0.97)',
        color: '#f8fafc',
        padding: '20px 24px',
        boxShadow: '0 -2px 16px rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          gap: 16,
          flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            {t('consent.body' as MessageKey)}
            {showDetails && (
              <span style={{ display: 'block', marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                {t('consent.details' as MessageKey)}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#7dd3c0',
              padding: 0,
              marginTop: 4,
              fontSize: 13,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showDetails ? t('consent.hideDetails' as MessageKey) : t('consent.showDetails' as MessageKey)}
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            [dir === 'rtl' ? 'marginLeft' : 'marginRight']: 0,
          }}
        >
          <button
            type="button"
            onClick={handleDecline}
            style={btnStyle('ghost')}
          >
            {t('consent.decline' as MessageKey)}
          </button>
          <button
            type="button"
            onClick={handleEssential}
            style={btnStyle('secondary')}
          >
            {t('consent.essentialOnly' as MessageKey)}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            style={btnStyle('primary')}
          >
            {t('consent.acceptAll' as MessageKey)}
          </button>
        </div>
      </div>
    </div>
  );
}

function btnStyle(variant: 'primary' | 'secondary' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  }
  if (variant === 'primary') {
    return { ...base, background: '#55CCB0', color: '#0E4B43', borderColor: '#55CCB0' }
  }
  if (variant === 'secondary') {
    return { ...base, background: 'transparent', color: '#f8fafc', borderColor: '#cbd5e1' }
  }
  return { ...base, background: 'transparent', color: '#cbd5e1', borderColor: 'transparent' }
}