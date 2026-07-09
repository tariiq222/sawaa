import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../infrastructure/cache/redis.service';

const CHALLENGE_TTL_SECONDS = 5 * 60;

type ChallengePayload = {
  userId: string;
  identifier: string;
};

/**
 * Short-lived proof that a super-admin has completed the password step.
 * It intentionally stores neither the password nor the OTP. The raw UUID is
 * opaque to the client and is consumed only after a successful OTP verify.
 */
@Injectable()
export class DashboardTwoFactorChallengeService {
  constructor(private readonly redis: RedisService) {}

  async create(userId: string, identifier: string): Promise<string> {
    const challenge = randomUUID();
    const stored: ChallengePayload = { userId, identifier };
    await this.redis.getClient().set(
      this.key(challenge),
      JSON.stringify(stored),
      'EX',
      CHALLENGE_TTL_SECONDS,
    );
    return challenge;
  }

  async assertValid(challenge: string | undefined, userId: string, identifier: string): Promise<void> {
    if (!challenge) throw new UnauthorizedException('Two-factor challenge is required');
    const value = await this.redis.getClient().get(this.key(challenge));
    if (!this.matches(value, userId, identifier)) {
      throw new UnauthorizedException('Invalid or expired two-factor challenge');
    }
  }

  /** Atomically compare and consume the challenge after a correct OTP. */
  async consume(challenge: string | undefined, userId: string, identifier: string): Promise<void> {
    if (!challenge) throw new UnauthorizedException('Two-factor challenge is required');
    const expected = JSON.stringify({ userId, identifier } satisfies ChallengePayload);
    const consumed = await this.redis.getClient().eval(
      "local value = redis.call('GET', KEYS[1]); if value == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end; return 0",
      1,
      this.key(challenge),
      expected,
    );
    if (consumed !== 1) throw new UnauthorizedException('Invalid or expired two-factor challenge');
  }

  private key(challenge: string): string {
    return `dashboard_2fa:challenge:${challenge}`;
  }

  private matches(value: string | null, userId: string, identifier: string): boolean {
    if (!value) return false;
    try {
      const payload = JSON.parse(value) as ChallengePayload;
      return payload.userId === userId && payload.identifier === identifier;
    } catch {
      return false;
    }
  }
}
