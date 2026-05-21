import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PasswordService } from '../shared/password.service';
import { TokenService, TokenPair } from '../shared/token.service';
import type { User } from '@prisma/client';
import type { LoginCommand } from './login.command';
import { DEFAULT_ORG_ID } from '../../../common/constants';

const LOCKOUT_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;
const MAX_EMAIL_RATE_LIMIT = 10;
const MAX_IP_RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW_SECONDS = 900;

@Injectable()
export class LoginHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
    private readonly cls: ClsService,
    private readonly redis: RedisService,
  ) {}

  async execute(cmd: LoginCommand): Promise<TokenPair & { user: User & { customRole: { permissions: { action: string; subject: string }[] } | null } }> {
    const ip = cmd.ip ?? 'unknown';
    const emailKey = `staff_login:email:${cmd.email}`;
    const ipKey = `staff_login:ip:${ip}`;
    const redisClient = this.redis.getClient();

    // P2-10: atomic INCR + EXPIRE via multi/exec to prevent race condition
    // where a crash between incr and expire leaves a key without TTL.
    const [emailMultiRes, ipMultiRes] = await Promise.all([
      redisClient.multi().incr(emailKey).expire(emailKey, RATE_LIMIT_WINDOW_SECONDS).exec(),
      redisClient.multi().incr(ipKey).expire(ipKey, RATE_LIMIT_WINDOW_SECONDS).exec(),
    ]);

    const emailAttempts = (emailMultiRes?.[0]?.[1] as number | undefined) ?? 0;
    const ipAttempts = (ipMultiRes?.[0]?.[1] as number | undefined) ?? 0;

    if (emailAttempts > MAX_EMAIL_RATE_LIMIT || ipAttempts > MAX_IP_RATE_LIMIT) {
      await Promise.all([
        redisClient.expire(emailKey, RATE_LIMIT_WINDOW_SECONDS),
        redisClient.expire(ipKey, RATE_LIMIT_WINDOW_SECONDS),
      ]);
      throw new UnauthorizedException('Too many attempts, try again later');
    }

    try {
      const result = await this.doLogin(cmd);
      await Promise.all([redisClient.del(emailKey), redisClient.del(ipKey)]);
      return result as TokenPair & { user: User & { customRole: { permissions: { action: string; subject: string }[] } | null } };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        await Promise.all([
          redisClient.expire(emailKey, RATE_LIMIT_WINDOW_SECONDS),
          redisClient.expire(ipKey, RATE_LIMIT_WINDOW_SECONDS),
        ]);
      }
      throw err;
    }
  }

  private async doLogin(cmd: LoginCommand): Promise<TokenPair & { user: User & { customRole: { permissions: { action: string; subject: string }[] } | null } }> {
    const user = await this.prisma.user.findUnique({
      where: { email: cmd.email },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    if (!user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account locked. Try again later.');
    }

    const valid = await this.password.verify(cmd.password, user.passwordHash);

    if (!valid) {
      // Atomic increment — `{ increment: 1 }` resolves in a single SQL statement,
      // so two parallel wrong-password attempts cannot both observe the same
      // pre-increment value and reset each other to 0.
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });

      if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: new Date(Date.now() + LOCKOUT_WINDOW_MINUTES * 60 * 1000),
          },
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil !== null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const tokens = await this.tokens.issueTokenPair(user, {
      organizationId: DEFAULT_ORG_ID,
      isSuperAdmin: user.isSuperAdmin ?? false,
    });

    return { ...tokens, user };
  }
}
