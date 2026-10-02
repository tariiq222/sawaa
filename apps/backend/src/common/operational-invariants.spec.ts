/**
 * Guards for the operational safety rules in the root CLAUDE.md. Each test
 * here fails when a load-bearing invariant changes, not when behaviour is
 * refactored. Read CLAUDE.md before "fixing" a failure in this file.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ZoomCredentialsService } from '../infrastructure/zoom/zoom-credentials.service';
import { SmsCredentialsService } from '../infrastructure/sms/sms-credentials.service';
import { EmailCredentialsService } from '../infrastructure/email/email-credentials.service';
import { MoyasarCredentialsService } from '../infrastructure/payments/moyasar-credentials.service';
import { AiProviderCredentialsService } from '../infrastructure/ai/ai-provider-credentials.service';
import { decryptSecret } from '../infrastructure/crypto/secret-crypto';
import { SmsProviderFactory } from '../infrastructure/sms/sms-provider.factory';
import { DEFAULT_VAT_RATE } from '../modules/finance/create-invoice/create-invoice.handler';
import { DEFAULT_ORG_ID } from './constants';

// Test-only keys (not secrets): 32 bytes of 0x07.
const TEST_KEY_BASE64 = Buffer.alloc(32, 7).toString('base64');
const TEST_PLATFORM_KEY_HEX = '07'.repeat(32);
const cfg = { get: () => TEST_KEY_BASE64 } as never;

/*
 * Ciphertexts produced once by the current code with the test keys above and
 * DEFAULT_ORG_ID. If any of these stop decrypting, every credential stored in
 * production has become undecryptable too: DEFAULT_ORG_ID, an HKDF salt, the
 * AAD, the envelope layout or the key derivation changed. Revert that change.
 */
const GOLDEN = {
  "zoom": "ZfTd7e5VxiOvc/Eqz8M7kIMfUf3f35Zrt16IkWZ0ik6fHe/HdbSoMGDiPbqp9xx00Rrit3dbFIV2df8t1+wh/t2I5L1PNVxUrQZ6l4z27HBajqM9mFRybwY3m9TXP2LX9w==",
  "sms": "lRS0QF52K9JXzAx4/Lti/gzH8o05ZFjgpi75BfTnZVEAxyDOleFej9cbQOQgVzJ5LwCUxtbVCu5B8rLrNADVBUFUdu+5fV9Q8cy83HWMzig=",
  "email": "t7RRDLXU3n/y52GEmnl6+wvsKyvuttGWwPeQSt1hhsv6ynfq4h3cDdnDH1h4MeJGN+5Z9zFAZARs8Kg/F5bcVAikT4lx7bVIpzifMmfYk0pzML3mODWlQA==",
  "moyasar": "yP8sNaRzPTcRXAM0NGJkXFzZ0xbp84G4+dFINJWAphNTRzxlDaAkacFxz5P3pclSiYOY",
  "ai": "v1.O3xbIMxQimdMKlBZbcn5be+dd6Pi9XmJ1lyC/T8gaR8B4yAPxys=",
  "platform": "f6036fb7a1f579d710e91dad9c5595739c72c36f3b101ab7196091f071039c808c57c6a3050544c0732b11"
} as const;

describe('operational invariant: provider credentials stay decryptable', () => {
  it('Zoom credentials (HKDF info = DEFAULT_ORG_ID)', () => {
    const svc = new ZoomCredentialsService(cfg);
    expect(svc.decrypt(GOLDEN.zoom, DEFAULT_ORG_ID)).toEqual({ zoomAccountId: 'acc', zoomClientId: 'cli', zoomClientSecret: 'sec' });
    expect(() => svc.decrypt(GOLDEN.zoom, 'another-org')).toThrow();
  });

  it('SMS credentials (HKDF info = DEFAULT_ORG_ID)', () => {
    const svc = new SmsCredentialsService(cfg);
    expect(svc.decrypt(GOLDEN.sms, DEFAULT_ORG_ID)).toEqual({ appSid: 'sid-1', apiKey: 'secret', sender: 'TEST' });
    expect(() => svc.decrypt(GOLDEN.sms, 'another-org')).toThrow();
  });

  it('Email credentials (HKDF info = DEFAULT_ORG_ID)', () => {
    const svc = new EmailCredentialsService(cfg);
    expect(svc.decrypt(GOLDEN.email, DEFAULT_ORG_ID)).toEqual({ host: 'smtp.example.com', port: 587, user: 'u', pass: 'p' });
    expect(() => svc.decrypt(GOLDEN.email, 'another-org')).toThrow();
  });

  it('Moyasar credentials (HKDF info = DEFAULT_ORG_ID)', () => {
    const svc = new MoyasarCredentialsService(cfg);
    expect(svc.decrypt(GOLDEN.moyasar, DEFAULT_ORG_ID)).toEqual({ secretKey: 'sk_test' });
    expect(() => svc.decrypt(GOLDEN.moyasar, 'another-org')).toThrow();
  });

  it('a ciphertext from one provider never decrypts as another (distinct HKDF salts)', () => {
    expect(() => new SmsCredentialsService(cfg).decrypt(GOLDEN.zoom, DEFAULT_ORG_ID)).toThrow();
  });

  it('AI provider key (AES-GCM AAD = DEFAULT_ORG_ID)', () => {
    expect(new AiProviderCredentialsService(cfg).decrypt(GOLDEN.ai)).toBe('sk-or-test');
  });

  it('platform settings secrets are bound to the PLATFORM_SETTINGS_KEY env var', () => {
    const previous = process.env.PLATFORM_SETTINGS_KEY;
    process.env.PLATFORM_SETTINGS_KEY = TEST_PLATFORM_KEY_HEX;
    try {
      expect(decryptSecret(GOLDEN.platform)).toBe('platform-secret');
    } finally {
      if (previous === undefined) delete process.env.PLATFORM_SETTINGS_KEY;
      else process.env.PLATFORM_SETTINGS_KEY = previous;
    }
  });
});

describe('operational invariant: VAT', () => {
  it('DEFAULT_VAT_RATE stays 0 — the center is not VAT-registered', () => {
    expect(DEFAULT_VAT_RATE).toBe(0);
  });

  it('no production source hardcodes a 15% VAT rate (code, copy, Swagger or fallbacks)', () => {
    const offenders = productionSources().filter(({ text }) => /\b0\.15\b|\b15\s?%/.test(text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });
});

describe('operational invariant: single-tenant SMS dispatch', () => {
  it('SmsProviderFactory.resolve takes no tenant argument', () => {
    expect(SmsProviderFactory.prototype.resolve.length).toBe(0);
  });

  it('no production source reintroduces forCurrentTenant', () => {
    const offenders = productionSources().filter(({ text }) => text.includes('forCurrentTenant'));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });
});

describe('operational invariant: staff notifications keep organizationId', () => {
  // comms/events/on-*-staff handlers return early when the payload has no
  // organizationId, so dropping it from a publisher silently kills staff
  // notifications. The field is optional in the payload types, so the
  // compiler cannot catch it — this scan does.
  const GUARDED_EVENTS = ['PaymentCompletedEvent', 'BookingCancelledEvent', 'BookingCreatedEvent', 'ClientEnrolledEvent'];

  it('every publisher of a staff-notified event passes organizationId', () => {
    const missing: string[] = [];
    let found = 0;
    for (const { path, text } of productionSources()) {
      for (const eventName of GUARDED_EVENTS) {
        const marker = `new ${eventName}(`;
        let index = text.indexOf(marker);
        while (index !== -1) {
          found += 1;
          const args = balancedArgs(text, index + marker.length - 1);
          if (!args.includes('organizationId')) missing.push(`${path}: ${eventName}`);
          index = text.indexOf(marker, index + marker.length);
        }
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});

/** Text between the parenthesis at `open` and its matching close. */
function balancedArgs(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return text.slice(open + 1);
}

function productionSources(): Array<{ path: string; text: string }> {
  const root = join(__dirname, '..');
  const out: Array<{ path: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.d.ts')) {
        out.push({ path: full.slice(root.length + 1), text: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(root);
  return out;
}
