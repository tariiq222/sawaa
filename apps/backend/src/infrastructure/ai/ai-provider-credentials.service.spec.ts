import { ConfigService } from '@nestjs/config';
import { AiProviderCredentialsService } from './ai-provider-credentials.service';

const KEY = Buffer.alloc(32, 7).toString('base64');
const config = (value = KEY) => ({ get: jest.fn().mockReturnValue(value) }) as unknown as ConfigService;

describe('AiProviderCredentialsService', () => {
  it('round-trips without placing plaintext in the envelope', () => {
    const service = new AiProviderCredentialsService(config());
    const ciphertext = service.encrypt('provider-secret-placeholder');
    expect(ciphertext).not.toContain('provider-secret-placeholder');
    expect(service.decrypt(ciphertext)).toBe('provider-secret-placeholder');
  });

  it('rejects tampering (including an AAD mismatch)', () => {
    const service = new AiProviderCredentialsService(config());
    const ciphertext = service.encrypt('secret');
    const [version, encoded] = ciphertext.split('.');
    const bytes = Buffer.from(encoded, 'base64');
    bytes[bytes.length - 1] ^= 1;
    expect(() => service.decrypt(`${version}.${bytes.toString('base64')}`)).toThrow();
  });

  it('rejects a ciphertext made with a different key', () => {
    const first = new AiProviderCredentialsService(config());
    const second = new AiProviderCredentialsService(config(Buffer.alloc(32, 8).toString('base64')));
    expect(() => second.decrypt(first.encrypt('secret'))).toThrow();
  });

  it.each(['v1.x', 'v1.', 'v1.abc.extra', 'v2.YWJj', 'v1.YWJj=', `v1.${Buffer.alloc(12 + 16).toString('base64')}`])('rejects malformed envelope %s', (envelope) => {
    const service = new AiProviderCredentialsService(config());
    expect(() => service.decrypt(envelope)).toThrow();
  });

  it('rejects empty API keys and invalid encryption keys', () => {
    const service = new AiProviderCredentialsService(config());
    expect(() => service.encrypt('')).toThrow();
    expect(() => new AiProviderCredentialsService(config(Buffer.alloc(31).toString('base64')))).toThrow(/32 bytes/);
    expect(() => new AiProviderCredentialsService(config(''))).toThrow(/missing/);
  });
});
