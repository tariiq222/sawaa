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

  async assertDailyTokenBudget(identity: string): Promise<void> {
    const used = Number((await this.redis.getClient().get(this.dailyTokenKey(identity))) ?? 0);
    if (used >= this.config.getOrThrow<number>('CHAT_DAILY_TOKEN_BUDGET')) {
      throw new ChatDailyBudgetExceeded();
    }
  }

  async recordTokenUsage(identity: string, tokensUsed: number): Promise<void> {
    if (!Number.isSafeInteger(tokensUsed) || tokensUsed <= 0) return;
    const total = Number(await this.redis.getClient().eval(INCREMENT_WITH_EXPIRY, 1, this.dailyTokenKey(identity), String(tokensUsed), String(this.secondsUntilUtcDayEnd())));
    if (total > this.config.getOrThrow<number>('CHAT_DAILY_TOKEN_BUDGET')) {
      throw new ChatDailyBudgetExceeded();
    }
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
