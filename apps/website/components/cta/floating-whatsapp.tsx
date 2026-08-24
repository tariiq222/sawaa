'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useT, useLocale } from '@/features/locale/locale-provider';
import { localeDir } from '@/features/locale/dir';
import { useBranding } from '@/features/branding/public';
import type { MessageKey } from '@/features/locale/dictionary';

const STORAGE_KEY = 'sawaa-chat-dismissed-at';
const DISMISS_COOLDOWN_HOURS = 24;

interface WhatsAppLinkProps {
  phone: string;
  message?: string;
}

/**
 * Floating click-to-WhatsApp button.
 *
 * Single fixed bottom-corner anchor. After a 1.5s delay (so it doesn't
 * pop in during initial paint / LCP measurement) it animates in.
 *
 * Dismissed state is persisted to localStorage with a 24h cooldown —
 * clicking X hides it for the day so we don't re-show it on every page
 * navigation, then it reappears the next day for new visitors.
 *
 * Respects RTL: pin to bottom-start in RTL, bottom-end in LTR so it
 * matches the natural reading direction.
 *
 * Hydration-safe: the component returns `null` on the server and on the
 * first client render, then mounts and reads the dismissed timestamp
 * from localStorage so React hydration matches.
 */
export function FloatingWhatsApp({ phone, message }: WhatsAppLinkProps) {
  const t = useT();
  const locale = useLocale();
  const dir = localeDir(locale);
  const branding = useBranding();

  // Brand-aware default: prefer a Saudi-friendly number; fall back to
  // the env-supplied number; fall back to the branding contact phone;
  // last-resort a clearly-not-real placeholder so the link doesn't 404.
  const waPhone =
    phone ??
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ??
    branding.contactPhone ??
    '966500000000'
  const waMessage =
    message ??
    (locale === 'en'
      ? 'Hello, I would like to inquire about your counseling services.'
      : 'السلام عليكم، أرغب في الاستفسار عن خدمات الاستشارة لديكم.')

  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  // Render `null` until mounted so the server output and the first
  // client render are byte-identical — no `typeof window`, localStorage,
  // or `Date.now()` reads happen during render.
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // One-shot read of the dismissed timestamp on mount. Failing
  // localStorage (private mode, quota) is non-fatal: we just show the
  // button.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const ts = Number(raw)
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_COOLDOWN_HOURS * 3_600_000) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical external-system sync on mount; see https://react.dev/learn/you-might-not-need-an-effect
          setDismissed(true)
        }
      }
    } catch {
      // localStorage unavailable — show the button
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (dismissed) return
    const t = window.setTimeout(() => setVisible(true), 1500)
    return () => window.clearTimeout(t)
  }, [dismissed])

  const handleDismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  if (!mounted || dismissed) return null

  const href = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`

  return (
    <div
      // Pinned to the side opposite the navbar so they don't overlap:
      // `left` in RTL (visual left), `right` in LTR (visual right).
      dir={dir}
      style={{
        position: 'fixed',
        zIndex: 40,
        bottom: 20,
        [dir === 'rtl' ? 'left' : 'right']: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      {open && (
        <div
          role="dialog"
          aria-label={t('whatsapp.greeting' as MessageKey)}
          style={{
            background: 'white',
            borderRadius: 16,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)',
            padding: '14px 18px',
            maxWidth: 320,
            border: '1px solid var(--sw-neutral-100)',
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--sw-secondary-700)',
            animation: 'sw-fade-in-up 240ms ease-out',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            {t('whatsapp.greeting' as MessageKey)}
          </p>
          <p
            style={{
              margin: '6px 0 10px',
              color: 'var(--sw-neutral-500)',
              fontSize: 13,
            }}
          >
            {t('whatsapp.body' as MessageKey)}
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#25D366',
              color: 'white',
              padding: '8px 14px',
              borderRadius: 8,
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            <MessageCircle size={16} />
            {t('whatsapp.cta' as MessageKey)}
          </a>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {open && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t('whatsapp.dismiss' as MessageKey)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 'none',
              background: 'rgba(15, 23, 42, 0.7)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t('whatsapp.cta' as MessageKey)}
          aria-expanded={open}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            border: 'none',
            background: '#25D366',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(37, 211, 102, 0.4)',
            transition: 'transform 200ms ease',
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.6)',
            pointerEvents: visible ? 'auto' : 'none',
          }}
        >
          <MessageCircle size={24} />
        </button>
      </div>
    </div>
  )
}