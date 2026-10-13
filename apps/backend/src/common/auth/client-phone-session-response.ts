import { InternalServerErrorException } from '@nestjs/common';
import type { Response } from 'express';
import type { ClientChannel } from './client-channel';

interface PhoneVerification {
  phone: string;
  tokens: { accessToken: string; refreshToken: string };
  tokenPair: { accessToken: string; rawRefresh: string; accessMaxAgeMs: number; refreshMaxAgeMs: number };
}

/** Keep rotated credentials in the original session transport. */
export function respondToClientPhoneVerification(result: PhoneVerification, channel: ClientChannel, response?: Response) {
  if (channel !== 'web') return { phone: result.phone, tokens: result.tokens };
  if (!response) throw new InternalServerErrorException('Cookie response is required');
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  response.cookie('client_access_token', result.tokenPair.accessToken, { ...options, maxAge: result.tokenPair.accessMaxAgeMs });
  response.cookie('client_refresh_token', result.tokenPair.rawRefresh, { ...options, maxAge: result.tokenPair.refreshMaxAgeMs });
  return { phone: result.phone };
}
