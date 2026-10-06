import { HttpException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { deliveryUnavailable } from './mobile-email-errors';

type Reservation = { key: string; id: string };
// Redis TIME avoids cross-instance clock drift. Every in-flight reservation
// consumes budget; only a definitively rejected reservation can be removed.
const RESERVE = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 3600000)
local cooldown = redis.call('PTTL', KEYS[2])
if cooldown > 0 then return {0, math.ceil(cooldown / 1000)} end
if redis.call('ZCARD', KEYS[1]) >= 5 then
 local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
 return {0, math.max(1, math.ceil((tonumber(oldest[2]) + 3600000 - now) / 1000))}
end
redis.call('ZADD', KEYS[1], now, ARGV[1])
redis.call('PEXPIRE', KEYS[1], 3600000)
redis.call('SET', KEYS[2], ARGV[1], 'PX', 60000)
return {1, 0}
`;
const SETTLE = `if ARGV[2] == 'rejected' then return redis.call('ZREM', KEYS[1], ARGV[1]) end return 0`;

@Injectable()
export class MobileEmailSendLimiter {
  constructor(private readonly redis: RedisService) {}
  async reserve(channel: 'EMAIL' | 'SMS', identifier: string): Promise<Reservation> {
    const hash = createHash('sha256').update(channel + ':' + identifier).digest('hex');
    const key = `mobile-email-send:{${hash}}`;
    const id = randomUUID();
    let result: number[];
    try { result = await this.redis.getClient().eval(RESERVE, 2, key, `${key}:cooldown`, id) as number[]; }
    catch { throw deliveryUnavailable(); }
    if (result[0] !== 1) throw new HttpException({ code: 'send_limited', retryAfterSeconds: result[1] }, 429);
    return { key, id };
  }
  async settle(reservation: Reservation, outcome: 'accepted' | 'rejected' | 'unknown'): Promise<void> {
    try { await this.redis.getClient().eval(SETTLE, 1, reservation.key, reservation.id, outcome); }
    catch { throw deliveryUnavailable(); }
  }
}
