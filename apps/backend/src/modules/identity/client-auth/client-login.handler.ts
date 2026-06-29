import { BadRequestException, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PasswordService } from '../shared/password.service';
import { ClientTokenService } from '../shared/client-token.service';
import { ClientLoginDto } from './client-login.dto';
import { maskIdentifier } from '../../../common/helpers/mask-pii.helper';

const MAX_IDENTIFIER_ATTEMPTS = 5;
const MAX_IP_ATTEMPTS = 20;
const LOCKOUT_MINUTES = 15;
const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 min

@Injectable()
export class ClientLoginHandler {
  private readonly logger = new Logger(ClientLoginHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwords: PasswordService,
    private readonly clientTokens: ClientTokenService,
  ) {}

  async execute(dto: ClientLoginDto, ip = 'unknown') {
    // Exactly one identifier. This is a request-shape error (no account
    // lookup has happened yet), so a descriptive message leaks nothing.
    if ((dto.email && dto.phone) || (!dto.email && !dto.phone)) {
      throw new BadRequestException('Provide exactly one of email or phone');
    }

    const identifier = (dto.email ?? dto.phone) as string;

    const client = await this.prisma.client.findFirst({
      where: dto.email
        ? { email: dto.email, deletedAt: null }
        : { phone: dto.phone, deletedAt: null },
    });

    if (!client || !client.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (client.lockoutUntil && client.lockoutUntil > new Date()) {
      // Same constant message as the wrong-password path — see note below.
      throw new UnauthorizedException('Invalid credentials');
    }

    const identifierKey = `client_login:id:${identifier}`;
    const ipKey = `client_login:ip:${ip}`;
    const redisClient = this.redis.getClient();

    // Atomic INCR + EXPIRE via multi/exec to prevent a race where a crash
    // between incr and expire leaves a key without TTL (mirrors staff login).
    const [identifierMultiRes, ipMultiRes] = await Promise.all([
      redisClient.multi().incr(identifierKey).expire(identifierKey, RATE_LIMIT_WINDOW_SECONDS).exec(),
      redisClient.multi().incr(ipKey).expire(ipKey, RATE_LIMIT_WINDOW_SECONDS).exec(),
    ]);

    const identifierAttempts = (identifierMultiRes?.[0]?.[1] as number | undefined) ?? 0;
    const ipAttempts = (ipMultiRes?.[0]?.[1] as number | undefined) ?? 0;

    if (identifierAttempts > MAX_IDENTIFIER_ATTEMPTS || ipAttempts > MAX_IP_ATTEMPTS) {
      await redisClient.expire(identifierKey, RATE_LIMIT_WINDOW_SECONDS);
      await redisClient.expire(ipKey, RATE_LIMIT_WINDOW_SECONDS);
      throw new UnauthorizedException('Too many attempts, try again later');
    }

    const passwordMatch = await this.passwords.verify(dto.password, client.passwordHash);

    if (!passwordMatch) {
      await this.prisma.client.update({
        where: { id: client.id },
        data: {
          loginAttempts: { increment: 1 },
          lockoutUntil:
            identifierAttempts >= MAX_IDENTIFIER_ATTEMPTS - 1
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
              : undefined,
        },
      });

      // Constant response on every failure path (unknown account, missing
      // password, wrong password, lockout) so the error message can't be used
      // to enumerate which emails/phones are registered. Lockout is still
      // enforced server-side via lockoutUntil above. Mirrors the staff
      // /auth/lookup fix.
      throw new UnauthorizedException('Invalid credentials');
    }

    if (client.loginAttempts > 0 || client.lockoutUntil) {
      await this.prisma.client.update({
        where: { id: client.id },
        data: { loginAttempts: 0, lockoutUntil: null },
      });
    }

    await this.prisma.client.update({
      where: { id: client.id },
      data: { lastLoginAt: new Date() },
    });

    await Promise.all([redisClient.del(identifierKey), redisClient.del(ipKey)]);

    // P1-7: pass the live tokenVersion so a prior password reset (which bumps
    // the version) does not lock the client out — the strategy compares the
    // JWT claim against Client.tokenVersion.
    const tokens = await this.clientTokens.issueTokenPair({
      id: client.id,
      email: client.email,
      tokenVersion: client.tokenVersion,
    });

    this.logger.log(`Client login: ${client.id} (${maskIdentifier(identifier)})`);

    return {
      accessToken: tokens.accessToken,
      accessMaxAgeMs: tokens.accessMaxAgeMs,
      refreshToken: tokens.rawRefresh,
      refreshMaxAgeMs: tokens.refreshMaxAgeMs,
      clientId: client.id,
    };
  }
}
