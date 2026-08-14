import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { RedisService } from '../../../infrastructure/cache/redis.service';

const RATE_WINDOW_SECONDS = 60;

const INCREMENT_WITH_EXPIRY = `
local total = redis.call('INCRBY', KEYS[1], ARGV[1])
if total == tonumber(ARGV[1]) then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return total
`;

const RESERVE_REMAINING_DAILY_BUDGET = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if current >= limit then
  return 0
end
local reserved = limit - current
redis.call('INCRBY', KEYS[1], reserved)
if current == 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return reserved
`;

const SETTLE_DAILY_TOKEN_RESERVATION = `
local reserved = tonumber(ARGV[1])
local actual = tonumber(ARGV[2])
local delta = actual - reserved
if delta ~= 0 then
  redis.call('INCRBY', KEYS[1], delta)
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
    const client = this.redis.getClient();
    const [identityCount, ipCount] = await Promise.all([
      client.eval(INCREMENT_WITH_EXPIRY, 1, this.minuteKey('identity', input.identity), '1', String(RATE_WINDOW_SECONDS)),
      client.eval(INCREMENT_WITH_EXPIRY, 1, this.minuteKey('ip', input.ipAddress), '1', String(RATE_WINDOW_SECONDS)),
    ]);
    const limit = this.config.getOrThrow<number>('CHAT_RATE_LIMIT_PER_MINUTE');
    if (Number(identityCount) > limit || Number(ipCount) > limit) {
      throw new HttpException('Chat message rate limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async reserveDailyTokenBudget(identity: string): Promise<ChatDailyTokenReservation> {
    const key = this.dailyTokenKey(identity);
    const reservedTokens = Number(await this.redis.getClient().eval(
      RESERVE_REMAINING_DAILY_BUDGET,
      1,
      key,
      String(this.config.getOrThrow<number>('CHAT_DAILY_TOKEN_BUDGET')),
      String(this.secondsUntilUtcDayEnd()),
    ));
    if (!Number.isSafeInteger(reservedTokens) || reservedTokens <= 0) {
      throw new ChatDailyBudgetExceeded();
    }
    return { key, reservedTokens };
  }

  async settleDailyTokenReservation(
    reservation: ChatDailyTokenReservation,
    actualTokens: number,
  ): Promise<void> {
    // A provider response without a positive, safe total is not evidence that
    // the provider was free. Keep the full reservation in that case.
    if (!Number.isSafeInteger(actualTokens) || actualTokens <= 0) return;
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
