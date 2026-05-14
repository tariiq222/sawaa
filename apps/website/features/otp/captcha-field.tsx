'use client';

import { forwardRef, useEffect } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

const TEST_SITE_KEY = '10000000-ffff-ffff-ffff-000000000001';
const SITE_KEY =
  process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ??
  (process.env.NODE_ENV !== 'production' ? TEST_SITE_KEY : '');

export const isCaptchaConfigured = !!SITE_KEY && SITE_KEY !== TEST_SITE_KEY;

interface CaptchaFieldProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark';
}

/**
 * Wraps the hCaptcha widget. When no real sitekey is configured the
 * cross-origin iframe renders an unstyled red "for testing only" warning
 * that overlaps form layouts. Replace it with a clean dev placeholder
 * that auto-issues a token. Production behaviour is unchanged.
 */
export const CaptchaField = forwardRef<HCaptcha, CaptchaFieldProps>(
  function CaptchaField({ onVerify, onExpire, theme = 'light' }, ref) {
    useEffect(() => {
      if (!isCaptchaConfigured) onVerify('dev-bypass');
    }, [onVerify]);

    if (!isCaptchaConfigured) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: '1px dashed var(--border)',
            background: 'color-mix(in srgb, var(--muted) 40%, transparent)',
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '9999px',
              background: 'var(--success, #16a34a)',
            }}
          />
          <span>Dev mode — captcha skipped</span>
        </div>
      );
    }

    return (
      <HCaptcha
        ref={ref}
        sitekey={SITE_KEY}
        onVerify={onVerify}
        onExpire={onExpire}
        theme={theme}
      />
    );
  },
);
