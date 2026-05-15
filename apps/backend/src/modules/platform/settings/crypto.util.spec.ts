import { encryptSecret, decryptSecret } from './crypto.util';

describe('crypto.util', () => {
  const originalKey = process.env.PLATFORM_SETTINGS_KEY;

  beforeAll(() => {
    process.env.PLATFORM_SETTINGS_KEY = 'a'.repeat(64);
  });

  afterAll(() => {
    process.env.PLATFORM_SETTINGS_KEY = originalKey;
  });

  it('should encrypt and decrypt plaintext', () => {
    const plaintext = 'my-secret-value';
    const ciphertext = encryptSecret(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.length).toBeGreaterThan(56); // iv(24) + tag(32) + some ciphertext

    const decrypted = decryptSecret(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw when key is not set', () => {
    delete process.env.PLATFORM_SETTINGS_KEY;
    expect(() => encryptSecret('test')).toThrow('PLATFORM_SETTINGS_KEY is not set');
    process.env.PLATFORM_SETTINGS_KEY = 'a'.repeat(64);
  });

  it('should throw when key is wrong length', () => {
    process.env.PLATFORM_SETTINGS_KEY = 'abc';
    expect(() => encryptSecret('test')).toThrow('PLATFORM_SETTINGS_KEY must be 32 bytes');
    process.env.PLATFORM_SETTINGS_KEY = 'a'.repeat(64);
  });
});
