import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationCredentialsService } from './integration-credentials.service';

function configWith(map: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => map[key]),
  } as unknown as ConfigService;
}

const KEY_A = Buffer.alloc(32, 1).toString('base64');
const KEY_B = Buffer.alloc(32, 2).toString('base64');

describe('IntegrationCredentialsService', () => {
  describe('constructor failures', () => {
    it('throws InternalServerErrorException when both keys are missing', () => {
      expect(
        () => new IntegrationCredentialsService(configWith({})),
      ).toThrow(InternalServerErrorException);
      expect(
        () => new IntegrationCredentialsService(configWith({})),
      ).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });

    it('throws when the key does not decode to 32 bytes', () => {
      const shortKey = Buffer.alloc(16, 1).toString('base64');
      expect(
        () =>
          new IntegrationCredentialsService(
            configWith({ INTEGRATION_ENCRYPTION_KEY: shortKey }),
          ),
      ).toThrow('Integration encryption key must decode to 32 bytes');
    });
  });

  describe('key sourcing', () => {
    it('falls back to MOYASAR_ENCRYPTION_KEY when INTEGRATION_ENCRYPTION_KEY is absent', () => {
      const viaFallback = new IntegrationCredentialsService(
        configWith({ MOYASAR_ENCRYPTION_KEY: KEY_A }),
      );
      const viaExplicit = new IntegrationCredentialsService(
        configWith({ INTEGRATION_ENCRYPTION_KEY: KEY_A }),
      );
      // Same master key → ciphertexts are interoperable across instances.
      const ct = viaFallback.encrypt({ token: 'abc' });
      expect(viaExplicit.decrypt(ct)).toEqual({ token: 'abc' });
    });

    it('prefers INTEGRATION_ENCRYPTION_KEY over MOYASAR_ENCRYPTION_KEY', () => {
      const preferred = new IntegrationCredentialsService(
        configWith({
          INTEGRATION_ENCRYPTION_KEY: KEY_A,
          MOYASAR_ENCRYPTION_KEY: KEY_B,
        }),
      );
      const moyasarOnly = new IntegrationCredentialsService(
        configWith({ MOYASAR_ENCRYPTION_KEY: KEY_B }),
      );
      const ct = preferred.encrypt({ token: 'abc' });
      // If the service had used the Moyasar key, this would succeed.
      expect(() => moyasarOnly.decrypt(ct)).toThrow();
    });
  });

  describe('encrypt / decrypt', () => {
    let service: IntegrationCredentialsService;

    beforeEach(() => {
      service = new IntegrationCredentialsService(
        configWith({ INTEGRATION_ENCRYPTION_KEY: KEY_A }),
      );
    });

    it('round-trips a payload', () => {
      const payload = { apiKey: 'k-1', secret: 'shh', nested: { a: 1 } };
      const ct = service.encrypt(payload);
      expect(typeof ct).toBe('string');
      expect(service.decrypt(ct)).toEqual(payload);
    });

    it('uses a fresh IV per call (ciphertexts differ, both decrypt)', () => {
      const payload = { apiKey: 'same' };
      const a = service.encrypt(payload);
      const b = service.encrypt(payload);
      expect(a).not.toBe(b);
      expect(service.decrypt(a)).toEqual(payload);
      expect(service.decrypt(b)).toEqual(payload);
    });

    it('never emits plaintext fields in the ciphertext', () => {
      const ct = service.encrypt({ apiKey: 'super-secret-value' });
      expect(ct).not.toContain('super-secret-value');
      expect(Buffer.from(ct, 'base64').toString('utf8')).not.toContain(
        'super-secret-value',
      );
    });

    it('throws on a tampered ciphertext (GCM auth failure)', () => {
      const ct = service.encrypt({ apiKey: 'k' });
      const buf = Buffer.from(ct, 'base64');
      buf[buf.length - 1] ^= 0xff; // flip last ciphertext byte
      expect(() => service.decrypt(buf.toString('base64'))).toThrow();
    });

    it('throws on a tampered auth tag', () => {
      const ct = service.encrypt({ apiKey: 'k' });
      const buf = Buffer.from(ct, 'base64');
      buf[12] ^= 0xff; // first tag byte (layout: iv 12 | tag 16 | ct)
      expect(() => service.decrypt(buf.toString('base64'))).toThrow();
    });

    it('throws when decrypting with a different master key', () => {
      const other = new IntegrationCredentialsService(
        configWith({ INTEGRATION_ENCRYPTION_KEY: KEY_B }),
      );
      const ct = service.encrypt({ apiKey: 'k' });
      expect(() => other.decrypt(ct)).toThrow();
    });

    it('throws on garbage input', () => {
      expect(() => service.decrypt('definitely-not-base64-gcm')).toThrow();
    });
  });
});
