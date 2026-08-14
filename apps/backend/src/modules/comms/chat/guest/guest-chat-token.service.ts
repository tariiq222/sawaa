import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const CHAT_GUEST_COOKIE_NAME = 'sawaa_chat_guest';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface IssuedGuestChatToken {
  rawToken: string;
  tokenHash: string;
}

@Injectable()
export class GuestChatTokenService {
  constructor(private readonly config: ConfigService) {}

  issue(): IssuedGuestChatToken {
    const rawToken = randomBytes(32).toString('base64url');
    return { rawToken, tokenHash: this.hash(rawToken) };
  }

  toStoredToken(rawToken: string): { tokenHash: string } {
    return { tokenHash: this.hash(rawToken) };
  }

  hash(rawToken: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('CHAT_GUEST_TOKEN_SECRET'))
      .update(rawToken)
      .digest('hex');
  }

  matches(rawToken: string, storedHash: string): boolean {
    const candidate = Buffer.from(this.hash(rawToken), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  }

  setCookieOptions(nodeEnv = process.env.NODE_ENV) {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: nodeEnv === 'production',
      path: '/api/v1/public',
      maxAge: this.config.getOrThrow<number>('CHAT_GUEST_SESSION_DAYS') * DAY_MS,
    };
  }

  clearCookieOptions(nodeEnv = process.env.NODE_ENV) {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: nodeEnv === 'production',
      path: '/api/v1/public',
    };
  }
}
