import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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
redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4])
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
local identityCurrent = tonumber(redis.call('GET', KEYS[1]) or '0')
local globalCurrent = tonumber(redis.call('GET', KEYS[2]) or '0')
local identityLimit = tonumber(ARGV[1])
local globalLimit = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
if requested <= 0 then
  return 0
end
if identityCurrent + requested > identityLimit then
  return 0
end
if globalCurrent + requested > globalLimit then
  return -1
end
redis.call('INCRBY', KEYS[1], requested)
if identityCurrent == 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[4])
end
redis.call('INCRBY', KEYS[2], requested)
if globalCurrent == 0 then
  redis.call('EXPIRE', KEYS[2], ARGV[4])
end
return requested
`;

const RESERVE_DAILY_BUDGET_TRIPLE = `
local identityCurrent = tonumber(redis.call('GET', KEYS[1]) or '0')
local ipCurrent = tonumber(redis.call('GET', KEYS[2]) or '0')
local globalCurrent = tonumber(redis.call('GET', KEYS[3]) or '0')
local identityLimit = tonumber(ARGV[1])
local ipLimit = tonumber(ARGV[2])
local globalLimit = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
if requested <= 0 then
  return 0
end
if identityCurrent + requested > identityLimit or ipCurrent + requested > ipLimit then
  return 0
end
if globalCurrent + requested > globalLimit then
  return -1
end
redis.call('INCRBY', KEYS[1], requested)
if identityCurrent == 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[5])
end
redis.call('INCRBY', KEYS[2], requested)
if ipCurrent == 0 then
  redis.call('EXPIRE', KEYS[2], ARGV[5])
end
redis.call('INCRBY', KEYS[3], requested)
if globalCurrent == 0 then
  redis.call('EXPIRE', KEYS[3], ARGV[5])
end
return requested
`;

const SETTLE_DAILY_TOKEN_RESERVATION = `
local reserved = tonumber(ARGV[1])
local actual = tonumber(ARGV[2])
if actual >= 0 and actual < reserved then
  local refund = reserved - actual
  for index = 1, #KEYS do
    redis.call('DECRBY', KEYS[index], refund)
  end
end
return redis.call('GET', KEYS[1])
`;

export interface ChatDailyTokenReservation {
  key: string;
  ipKey?: string;
  globalKey: string;
  reservedTokens: number;
}

export type ChatDailyBudgetScope = 'caller' | 'global';

export class ChatDailyBudgetExceeded extends HttpException {
  constructor(readonly scope: ChatDailyBudgetScope = 'caller') {
    super('Daily chat usage limit reached', HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class ChatUsageLimitsService {
  private readonly logger = new Logger(ChatUsageLimitsService.name);
  private lastGlobalCapWarnUtcDay: string | undefined;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async consumeMessage(input: { identity: string; ipAddress: string }): Promise<void> {
    const accepted = Number(await this.redis.getClient().eval(
      CONSUME_MESSAGE_RATE_LIMIT,
      3,
      this.minuteKey('identity', input.identity),
      this.minuteKey('ip', input.ipAddress),
      this.ipBindKey(input.identity),
      String(this.config.getOrThrow<number>('CHAT_RATE_LIMIT_PER_MINUTE')),
      String(RATE_WINDOW_SECONDS),
      this.opaque(input.ipAddress),
      String(Math.max(this.secondsUntilUtcDayEnd(), 86_400)),
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
    ipAddress?: string,
  ): Promise<ChatDailyTokenReservation> {
    if (!Number.isSafeInteger(requestedTokens) || requestedTokens <= 0) {
      throw new ChatDailyBudgetExceeded();
    }
    const key = this.dailyTokenKey(identity);
    const globalKey = this.dailyGlobalTokenKey();
    const ipOpaque = await this.resolveOpaqueIp(identity, ipAddress);
    const ttl = String(this.secondsUntilUtcDayEnd());
    const identityLimit = String(this.config.getOrThrow<number>('CHAT_DAILY_TOKEN_BUDGET'));
    const globalLimit = String(this.config.getOrThrow<number>('CHAT_DAILY_TOKEN_BUDGET_GLOBAL'));
    if (ipOpaque) {
      const ipKey = this.dailyIpTokenKey(ipOpaque);
      const reservedTokens = Number(await this.redis.getClient().eval(
        RESERVE_DAILY_BUDGET_TRIPLE,
        3,
        key,
        ipKey,
        globalKey,
        identityLimit,
        String(this.config.getOrThrow<number>('CHAT_DAILY_TOKEN_BUDGET_PER_IP')),
        globalLimit,
        String(requestedTokens),
        ttl,
      ));
      this.acceptReservation(reservedTokens, requestedTokens);
      return { key, ipKey, globalKey, reservedTokens };
    }
    const reservedTokens = Number(await this.redis.getClient().eval(
      RESERVE_DAILY_BUDGET,
      2,
      key,
      globalKey,
      identityLimit,
      globalLimit,
      String(requestedTokens),
      ttl,
    ));
    this.acceptReservation(reservedTokens, requestedTokens);
    return { key, globalKey, reservedTokens };
  }

  async settleDailyTokenReservation(
    reservation: ChatDailyTokenReservation,
    actualTokens: number,
  ): Promise<void> {
    // A provider response without a positive, bounded total is not evidence
    // that any reservation is safe to release. Retain it through the UTC TTL.
    if (!Number.isSafeInteger(actualTokens) || actualTokens <= 0 || actualTokens > reservation.reservedTokens) return;
    await this.settleKeys(reservation, actualTokens);
  }

  async releaseDailyTokenReservation(reservation: ChatDailyTokenReservation): Promise<void> {
    await this.settleKeys(reservation, 0);
  }

  private acceptReservation(reservedTokens: number, requestedTokens: number): void {
    if (reservedTokens === -1) {
      this.warnGlobalCapOnce();
      throw new ChatDailyBudgetExceeded('global');
    }
    if (!Number.isSafeInteger(reservedTokens) || reservedTokens !== requestedTokens) {
      throw new ChatDailyBudgetExceeded();
    }
  }

  private warnGlobalCapOnce(): void {
    const utcDay = new Date().toISOString().slice(0, 10);
    if (this.lastGlobalCapWarnUtcDay === utcDay) return;
    this.lastGlobalCapWarnUtcDay = utcDay;
    const ceiling = this.config.getOrThrow<number>('CHAT_DAILY_TOKEN_BUDGET_GLOBAL');
    this.logger.warn(`CHAT_DAILY_TOKEN_BUDGET_GLOBAL exhausted utcDay=${utcDay} ceiling=${ceiling}`);
  }

  private reservationKeys(reservation: ChatDailyTokenReservation): string[] {
    return reservation.ipKey
      ? [reservation.key, reservation.ipKey, reservation.globalKey]
      : [reservation.key, reservation.globalKey];
  }

  private async settleKeys(reservation: ChatDailyTokenReservation, actualTokens: number): Promise<void> {
    const keys = this.reservationKeys(reservation);
    await this.redis.getClient().eval(
      SETTLE_DAILY_TOKEN_RESERVATION,
      keys.length,
      ...keys,
      String(reservation.reservedTokens),
      String(actualTokens),
    );
  }

  private async resolveOpaqueIp(identity: string, ipAddress?: string): Promise<string | undefined> {
    if (typeof ipAddress === 'string' && ipAddress.length > 0) {
      return this.opaque(ipAddress);
    }
    const bound = await this.redis.getClient().get(this.ipBindKey(identity));
    if (typeof bound === 'string' && /^[a-f0-9]{64}$/.test(bound)) {
      return bound;
    }
    return undefined;
  }

  private minuteKey(scope: 'identity' | 'ip', value: string): string {
    return `chat:rate:${scope}:${this.opaque(value)}`;
  }

  private ipBindKey(identity: string): string {
    return `chat:ip-bind:${this.opaque(identity)}`;
  }

  private dailyTokenKey(identity: string): string {
    return `chat:tokens:${new Date().toISOString().slice(0, 10)}:${this.opaque(identity)}`;
  }

  private dailyIpTokenKey(opaqueIp: string): string {
    return `chat:tokens:ip:${new Date().toISOString().slice(0, 10)}:${opaqueIp}`;
  }

  private dailyGlobalTokenKey(): string {
    return `chat:tokens:global:${new Date().toISOString().slice(0, 10)}`;
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
