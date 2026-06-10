import { encryptSecret, decryptSecret } from './secret-crypto';

const KEY_ENV = 'PLATFORM_SETTINGS_KEY';

/** Deterministic 32-byte key (64 hex chars). */
const VALID_KEY = Buffer.alloc(32, 7).toString('hex');
const OTHER_KEY = Buffer.alloc(32, 9).toString('hex');

describe('secret-crypto', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env[KEY_ENV];
    process.env[KEY_ENV] = VALID_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[KEY_ENV];
    } else {
      process.env[KEY_ENV] = originalKey;
    }
  });

  describe('key loading failures', () => {
    it('encryptSecret throws when PLATFORM_SETTINGS_KEY is not set', () => {
      delete process.env[KEY_ENV];
      expect(() => encryptSecret('top-secret')).toThrow(
        'PLATFORM_SETTINGS_KEY is not set',
      );
    });

    it('decryptSecret throws when PLATFORM_SETTINGS_KEY is not set', () => {
      const ciphertext = encryptSecret('top-secret');
      delete process.env[KEY_ENV];
      expect(() => decryptSecret(ciphertext)).toThrow(
        'PLATFORM_SETTINGS_KEY is not set',
      );
    });

    it('throws when the key is not 32 bytes', () => {
      process.env[KEY_ENV] = Buffer.alloc(16, 1).toString('hex'); // 16 bytes
      expect(() => encryptSecret('x')).toThrow(
        'PLATFORM_SETTINGS_KEY must be 32 bytes (64 hex chars)',
      );
    });

    it('throws when the key is not valid hex', () => {
      process.env[KEY_ENV] = 'zz'.repeat(32); // invalid hex → empty/short buffer
      expect(() => encryptSecret('x')).toThrow(
        'PLATFORM_SETTINGS_KEY must be 32 bytes (64 hex chars)',
      );
    });
  });

  describe('round-trip', () => {
    it('decrypts what it encrypted', () => {
      const plain = 'platform-api-token-123';
      expect(decryptSecret(encryptSecret(plain))).toBe(plain);
    });

    it('handles unicode payloads', () => {
      const plain = 'سر المنصة 🔐 line';
      expect(decryptSecret(encryptSecret(plain))).toBe(plain);
    });

    it('handles empty string', () => {
      expect(decryptSecret(encryptSecret(''))).toBe('');
    });

    it('produces a fresh IV per call (ciphertexts differ, both decrypt)', () => {
      const a = encryptSecret('same-input');
      const b = encryptSecret('same-input');
      expect(a).not.toBe(b);
      expect(decryptSecret(a)).toBe('same-input');
      expect(decryptSecret(b)).toBe('same-input');
    });

    it('emits the documented hex layout: iv(24) + tag(32) + ciphertext', () => {
      const out = encryptSecret('abc');
      expect(out).toMatch(/^[0-9a-f]+$/);
      // 24 hex iv + 32 hex tag + 6 hex for 3 utf8 bytes
      expect(out).toHaveLength(24 + 32 + 6);
    });
  });

  describe('tamper and wrong-key failures', () => {
    it('throws on a tampered ciphertext body (auth tag mismatch)', () => {
      const out = encryptSecret('do-not-touch');
      const flipped = (out[56] === '0' ? '1' : '0') + '';
      const tampered = out.slice(0, 56) + flipped + out.slice(57);
      expect(() => decryptSecret(tampered)).toThrow();
    });

    it('throws on a tampered auth tag', () => {
      const out = encryptSecret('do-not-touch');
      const flipped = (out[24] === '0' ? '1' : '0') + '';
      const tampered = out.slice(0, 24) + flipped + out.slice(25);
      expect(() => decryptSecret(tampered)).toThrow();
    });

    it('throws when decrypting with a different key', () => {
      const out = encryptSecret('rotate-me');
      process.env[KEY_ENV] = OTHER_KEY;
      expect(() => decryptSecret(out)).toThrow();
    });

    it('throws on garbage input', () => {
      expect(() => decryptSecret('not-a-ciphertext')).toThrow();
    });
  });
});
