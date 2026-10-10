import { BadRequestException, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PasswordService } from '../shared/password.service';
import { ClientTokenService } from '../shared/client-token.service';
import { ClientLoginDto } from './client-login.dto';
import { maskIdentifier } from '../../../common/helpers/mask-pii.helper';

import { ClientPasswordAttempt, consumeClientPasswordAttempt, countClientPasswordAttempt, DUMMY_PASSWORD_HASH, MAX_CLIENT_IDENTIFIER_ATTEMPTS } from '../shared/password-login-security';

const LOCKOUT_MINUTES = 15;

@Injectable()
export class ClientLoginHandler {
  private readonly logger = new Logger(ClientLoginHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwords: PasswordService,
    private readonly clientTokens: ClientTokenService,
  ) {}

  async execute(dto: ClientLoginDto, ip = 'unknown', expectedClientId?: string, admittedAttempt?: ClientPasswordAttempt) {
    // Exactly one identifier. This is a request-shape error (no account
    // lookup has happened yet), so a descriptive message leaks nothing.
    if ((dto.email && dto.phone) || (!dto.email && !dto.phone)) {
      throw new BadRequestException('Provide exactly one of email or phone');
    }

    const identifier = (dto.email ?? dto.phone) as string;

    // Unknown and ineligible accounts consume the same budget before DB/bcrypt.
    const redisClient = this.redis.getClient();
    const attempt = admittedAttempt
      ? await consumeClientPasswordAttempt(admittedAttempt, redisClient, identifier, ip).catch(async (error) => {
        // Pad delegation rejection, especially canonical alias exhaustion,
        // so it cannot become a cheap account-state oracle. The optional
        // receipt is internal-only; controllers never accept it from DTOs.
        await this.passwords.verify(dto.password, DUMMY_PASSWORD_HASH);
        throw error;
      })
      : await countClientPasswordAttempt(redisClient, identifier, ip);
    const { identifierAttempts, identifierKey, ipKey } = attempt;
    const client = await this.prisma.client.findFirst({
      where: {
        ...(dto.email ? { email: dto.email } : { phone: dto.phone }),
        deletedAt: null,
        ...(expectedClientId ? { id: expectedClientId } : {}),
      },
    });

    if (!client || !client.passwordHash || client.isActive === false || client.deletedAt ||
        (client.lockoutUntil && client.lockoutUntil > new Date())) {
      await this.passwords.verify(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await this.passwords.verify(dto.password, client.passwordHash);

    if (!passwordMatch) {
      await this.prisma.client.update({
        where: { id: client.id },
        data: {
          loginAttempts: { increment: 1 },
          lockoutUntil:
            identifierAttempts >= MAX_CLIENT_IDENTIFIER_ATTEMPTS - 1
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
      emailVerified: client.emailVerified,
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
