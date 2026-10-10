import { UnauthorizedException } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/cache/redis.service';

// A fixed cost-12 bcrypt hash of random, discarded input, never a credential.
// Compare only after rate limiting; always reject regardless of the result.
// This approximates password verification cost, not constant-time DB access.
export const DUMMY_PASSWORD_HASH = '$2b$12$OTUCK0gsqMav/XB.vhQwA.AgOdHmztTW/gfHrnCM9h.GbE9ctxf62';
export const MAX_CLIENT_IDENTIFIER_ATTEMPTS = 5;
const MAX_CLIENT_IP_ATTEMPTS = 20;
const CLIENT_RATE_LIMIT_WINDOW_SECONDS = 600;
type RedisClient = ReturnType<RedisService['getClient']>;
interface AttemptData {
  identifierAttempts: number;
  identifierKey: string;
  ipKey: string;
}
// Only this module can mint a valid receipt; DTO data cannot bypass admission.
// Receipts are single-use and bound to the exact Redis connection and IP.
export interface ClientPasswordAttempt extends AttemptData { readonly receipt: object }
const admittedAttempts = new WeakMap<object, { redisClient: RedisClient; ip: string; data: AttemptData }>();

async function increment(redisClient: RedisClient, key: string): Promise<number> {
  const result = await redisClient.multi().incr(key).expire(key, CLIENT_RATE_LIMIT_WINDOW_SECONDS).exec();
  const count = result?.[0]?.[1];
  if (!result || result.some(([error]) => error) || typeof count !== 'number' || count < 1) {
    throw new UnauthorizedException('Invalid credentials');
  }
  return count;
}

export async function countClientPasswordAttempt(redisClient: RedisClient, identifier: string, ip: string): Promise<ClientPasswordAttempt> {
  const identifierKey = `client_login:id:${identifier}`;
  const ipKey = `client_login:ip:${ip}`;
  const [identifierAttempts, ipAttempts] = await Promise.all([
    increment(redisClient, identifierKey), increment(redisClient, ipKey),
  ]);
  if (identifierAttempts > MAX_CLIENT_IDENTIFIER_ATTEMPTS || ipAttempts > MAX_CLIENT_IP_ATTEMPTS) {
    throw new UnauthorizedException('Invalid credentials');
  }
  const data = { identifierAttempts, identifierKey, ipKey };
  const receipt = {};
  admittedAttempts.set(receipt, { redisClient, ip, data });
  return { ...data, receipt };
}

export async function consumeClientPasswordAttempt(
  attempt: ClientPasswordAttempt, redisClient: RedisClient, identifier: string, ip: string,
): Promise<AttemptData> {
  const admitted = admittedAttempts.get(attempt.receipt);
  admittedAttempts.delete(attempt.receipt);
  if (!admitted || admitted.redisClient !== redisClient || admitted.ip !== ip) {
    throw new UnauthorizedException('Invalid credentials');
  }
  const identifierKey = `client_login:id:${identifier}`;
  // User-only verified email can resolve to a linked Client phone. Preserve
  // that canonical contact's budget, but never count the shared IP twice.
  const identifierAttempts = identifierKey === admitted.data.identifierKey
    ? admitted.data.identifierAttempts : await increment(redisClient, identifierKey);
  if (identifierAttempts > MAX_CLIENT_IDENTIFIER_ATTEMPTS) throw new UnauthorizedException('Invalid credentials');
  return { ...admitted.data, identifierAttempts, identifierKey };
}
