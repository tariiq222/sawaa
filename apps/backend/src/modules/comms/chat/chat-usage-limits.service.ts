import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { RedisService } from '../../../infrastructure/cache/redis.service';

const RATE_WINDOW_SECONDS = 60;

const CONSUME_MESSAGE_RATE_LIMIT = `
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local identity = redis.call('INCR', KEYS[1])
if identity == 1 then redis.call('EXPIRE', KEYS[1], ttl) end
local ip = redis.call('INCR', KEYS[2])
if ip == 1 then redis.call('EXPIRE', KEYS[2], ttl) end
if identity > limit or ip > limit then
  redis.call('DECR', KEYS[1])
  redis.call('DECR', KEYS[2])
  return 0
end
return 1
`;

const REFUND_MESSAGE_RATE_LIMIT = `
for index = 1, 2 do
  local remaining = redis.call('DECR', KEYS[index])
  if remaining <= 0 then redis.call('DEL', KEYS[index]) end
end
return 1
`;

const RESERVE_DAILY_BUDGET = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
local requested = tonumber(ARGV[2])
if requested <= 0 or current + requested > limit then
  return 0
end
redis.call('INCRBY', KEYS[1], requested)
if current == 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[3])
end
return requested
`;

const SETTLE_DAILY_TOKEN_RESERVATION = `
local reserved = tonumber(ARGV[1])
local actual = tonumber(ARGV[2])
if actual > 0 and actual < reserved then
  redis.call('DECRBY', KEYS[1], reserved - actual)
end
return redis.call('GET', KEYS[1])
`;

export interface ChatDailyTokenReservation {
  key: string;
  reservedTokens: number;
}

export class ChatDailyBudgetExceeded extends HttpException {
  constructor() {
    super('Daily chat usage limit reached', HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class ChatUsageLimitsService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async consumeMessage(input: { identity: string; ipAddress: string }): Promise<void> {
    const accepted = Number(await this.redis.getClient().eval(
      CONSUME_MESSAGE_RATE_LIMIT,
      2,
      this.minuteKey('identity', input.identity),
      this.minuteKey('ip', input.ipAddress),
      String(this.config.getOrThrow<number>('CHAT_RATE_LIMIT_PER_MINUTE')),
      String(RATE_WINDOW_SECONDS),
    ));
    if (accepted === 1) return;
    throw new HttpException('Chat message rate limit reached', HttpStatus.TOO_MANY_REQUESTS);
  }

  async refundMessage(input: { identity: string; ipAddress: string }): Promise<void> {
    await this.redis.getClient().eval(
      REFUND_MESSAGE_RATE_LIMIT,
      2,
      this.minuteKey('identity', input.identity),
      this.minuteKey('ip', input.ipAddress),
    );
  }

  async reserveDailyTokenBudget(
    identity: string,
    requestedTokens: number,
  ): Promise<ChatDailyTokenReservation> {
    if (!Number.isSafeInteger(requestedTokens) || requestedTokens <= 0) {
      throw new ChatDailyBudgetExceeded();
    }
    const key = this.dailyTokenKey(identity);
    const reservedTokens = Number(await this.redis.getClient().eval(
      RESERVE_DAILY_BUDGET,
      1,
      key,
      String(this.config.getOrThrow<number>('CHAT_DAILY_TOKEN_BUDGET')),
      String(requestedTokens),
      String(this.secondsUntilUtcDayEnd()),
    ));
    if (!Number.isSafeInteger(reservedTokens) || reservedTokens !== requestedTokens) {
      throw new ChatDailyBudgetExceeded();
    }
    return { key, reservedTokens };
  }

  async settleDailyTokenReservation(
    reservation: ChatDailyTokenReservation,
    actualTokens: number,
  ): Promise<void> {
    // A provider response without a positive, bounded total is not evidence
    // that any reservation is safe to release. Retain it through the UTC TTL.
    if (!Number.isSafeInteger(actualTokens) || actualTokens <= 0 || actualTokens > reservation.reservedTokens) return;
    await this.redis.getClient().eval(
      SETTLE_DAILY_TOKEN_RESERVATION,
      1,
      reservation.key,
      String(reservation.reservedTokens),
      String(actualTokens),
    );
  }

  async releaseDailyTokenReservation(reservation: ChatDailyTokenReservation): Promise<void> {
    await this.redis.getClient().eval(
      SETTLE_DAILY_TOKEN_RESERVATION,
      1,
      reservation.key,
      String(reservation.reservedTokens),
      '0',
    );
  }

  private minuteKey(scope: 'identity' | 'ip', value: string): string {
    return `chat:rate:${scope}:${this.opaque(value)}`;
  }

  private dailyTokenKey(identity: string): string {
    return `chat:tokens:${new Date().toISOString().slice(0, 10)}:${this.opaque(identity)}`;
  }

  private opaque(value: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('CHAT_GUEST_TOKEN_SECRET')).update(value).digest('hex');
  }

  private secondsUntilUtcDayEnd(): number {
    const now = new Date();
    const nextUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return Math.max(1, Math.ceil((nextUtcDay - now.getTime()) / 1000));
  }
}
