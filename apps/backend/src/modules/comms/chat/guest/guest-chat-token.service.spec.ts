import { ConfigService } from '@nestjs/config';
import { GuestChatTokenService } from './guest-chat-token.service';

describe('GuestChatTokenService', () => {
  const secret = 'test-only-chat-guest-token-secret';
  let service: GuestChatTokenService;

  beforeEach(() => {
    service = new GuestChatTokenService({
      getOrThrow: jest.fn().mockReturnValue(secret),
    } as unknown as ConfigService);
  });

  it('generates a random token with at least 32 bytes of entropy', () => {
    const first = service.issue();
    const second = service.issue();

    expect(Buffer.from(first.rawToken, 'base64url')).toHaveLength(32);
    expect(second.rawToken).not.toBe(first.rawToken);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('derives a stable HMAC hash without exposing the raw token from the storage value', () => {
    const stored = service.toStoredToken('guest-token-for-storage');

    expect(stored).toEqual({ tokenHash: service.hash('guest-token-for-storage') });
    expect(stored).not.toHaveProperty('rawToken');
    expect(stored.tokenHash).not.toContain('guest-token-for-storage');
  });

  it('rejects a token that does not match the stored HMAC', () => {
    const storedHash = service.hash('guest-a');

    expect(service.matches('guest-a', storedHash)).toBe(true);
    expect(service.matches('guest-b', storedHash)).toBe(false);
  });

  it('uses a HttpOnly Lax cookie and sets Secure only in production', () => {
    expect(service.cookieOptions('development')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/v1/public',
    });
    expect(service.cookieOptions('production')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/api/v1/public',
    });
  });

  it('does not substitute an insecure secret when CHAT_GUEST_TOKEN_SECRET is absent', () => {
    const config = { getOrThrow: jest.fn().mockImplementation(() => { throw new Error('missing'); }) };
    const missingSecretService = new GuestChatTokenService(config as unknown as ConfigService);

    expect(() => missingSecretService.issue()).toThrow('missing');
  });
});
