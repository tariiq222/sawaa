import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ClientLoginHandler } from '../client-auth/client-login.handler';
import { ClientLoginDto } from '../client-auth/client-login.dto';
import { normalizeIdentifier } from '../shared/identifier-detector';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PasswordService } from '../shared/password.service';
import { countClientPasswordAttempt, DUMMY_PASSWORD_HASH } from '../shared/password-login-security';
import { RefreshTokenSource, type User } from '@prisma/client';
import { TokenService } from '../shared/token.service';
import { isMobileStaffEligible } from '../shared/mobile-staff-eligibility';
import { PlatformSettingsService } from '../../platform/settings/platform-settings.service';

const STAFF_LOCKOUT_MINUTES = 15;
const STAFF_MAX_FAILED_ATTEMPTS = 5;

export interface MobilePasswordLoginResult {
  sessionKind: 'client' | 'staff';
  tokens: { accessToken: string; refreshToken: string };
}

@Injectable()
export class MobilePasswordLoginHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly login: ClientLoginHandler,
    private readonly redis: RedisService,
    private readonly passwords: PasswordService,
    private readonly staffTokens: TokenService,
    private readonly settings: PlatformSettingsService,
  ) {}

  private async rejectCredentials(password: string): Promise<never> {
    await this.passwords.verify(password, DUMMY_PASSWORD_HASH);
    throw new UnauthorizedException('Invalid credentials');
  }

  async execute(dto: ClientLoginDto, ip = 'unknown'): Promise<MobilePasswordLoginResult> {
    if ((dto.email && dto.phone) || (!dto.email && !dto.phone)) {
      throw new BadRequestException('Provide exactly one of email or phone');
    }
    const channel = dto.email ? 'EMAIL' : 'SMS';
    const identifier = normalizeIdentifier((dto.email ?? dto.phone)!, channel);
    // All web/mobile identities pass the same gate before DB/bcrypt. Pass a
    // single-use internal receipt so delegation cannot count the IP twice.
    const redisClient = this.redis.getClient();
    const attempt = await countClientPasswordAttempt(redisClient, identifier, ip);
    const { identifierKey, ipKey } = attempt;
    const contact = channel === 'EMAIL'
      ? { email: { equals: identifier, mode: 'insensitive' as const } }
      : { phone: identifier };
    const users = await this.prisma.user.findMany({ where: contact });
    if (users.length > 1) return this.rejectCredentials(dto.password);
    const matchedUser = users[0];
    if (matchedUser && matchedUser.role !== 'CLIENT') {
      const staffTokens = await this.staffLogin(matchedUser.id, contact, channel, dto.password);
      await Promise.all([redisClient.del(identifierKey), redisClient.del(ipKey)]);
      return { sessionKind: 'staff', tokens: staffTokens };
    }
    const clients = await this.prisma.client.findMany({
      where: { OR: [contact, ...(matchedUser ? [{ userId: matchedUser.id }] : [])] },
    });
    if (clients.length !== 1) return this.rejectCredentials(dto.password);
    const client = clients[0];
    if (!client.isActive || client.deletedAt) return this.rejectCredentials(dto.password);

    const user = client.userId
      ? await this.prisma.user.findUnique({ where: { id: client.userId } })
      : null;
    if ((client.userId && !user) || (matchedUser && matchedUser.id !== user?.id)) {
      return this.rejectCredentials(dto.password);
    }
    if (user) {
      if (!user.isActive || user.role !== 'CLIENT' || user.isSuperAdmin ||
          (client.email && normalizeIdentifier(client.email, 'EMAIL') !== normalizeIdentifier(user.email, 'EMAIL')) ||
          (client.phone && user.phone && client.phone !== user.phone)) {
        return this.rejectCredentials(dto.password);
      }
      const linked = await this.prisma.client.findMany({ where: { userId: user.id } });
      if (linked.length !== 1 || linked[0].id !== client.id) return this.rejectCredentials(dto.password);
    }
    const verified = channel === 'EMAIL'
      ? (client.email && normalizeIdentifier(client.email, 'EMAIL') === identifier && client.emailVerified) ||
        (user && normalizeIdentifier(user.email, 'EMAIL') === identifier && user.emailVerifiedAt)
      : (client.phone === identifier && client.phoneVerified) ||
        (user?.phone === identifier && user.phoneVerifiedAt);
    if (!verified) return this.rejectCredentials(dto.password);

    // A mobile registration can keep its verified email on User only. Use the
    // linked Client's existing contact for the shared password/lockout path.
    const loginDto: ClientLoginDto = channel === 'EMAIL' && client.email
      ? { email: client.email, password: dto.password }
      : { phone: client.phone ?? undefined, password: dto.password };
    if (!loginDto.email && !loginDto.phone) return this.rejectCredentials(dto.password);
    try {
      const result = await this.login.execute(loginDto, ip, client.id, attempt, 'mobile');
      await Promise.all([redisClient.del(identifierKey), redisClient.del(ipKey)]);
      return { sessionKind: 'client', tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken } };
    } catch (error) {
      // Rate-limit and account failures have the same public response.
      // Shared login already performed its comparison (or rejected a limit).
      if (error instanceof UnauthorizedException) throw new UnauthorizedException('Invalid credentials');
      throw error;
    }
  }

  /** Same router rule as mobile OTP entry: staff only when linked to an active Employee and not a Client. */
  private async staffLogin(
    userId: string,
    contact: Record<string, unknown>,
    channel: 'EMAIL' | 'SMS',
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customRole: { include: { permissions: true } } },
    });
    if (!user) return this.rejectCredentials(password);
    // Same rule as the OTP routers: a staff identity must not collide with any
    // live Client on either contact channel or via the user link.
    const clients = await this.prisma.client.findMany({ where: {
      deletedAt: null,
      OR: [contact, { email: { equals: user.email, mode: 'insensitive' } }, ...(user.phone ? [{ phone: user.phone }] : []), { userId: user.id }],
    } });
    const contactVerified = channel === 'EMAIL' ? user.emailVerifiedAt : user.phoneVerifiedAt;
    const eligible = user.isActive && clients.length === 0 && !!contactVerified &&
      !!user.passwordHash && !(user.lockedUntil && user.lockedUntil > new Date()) &&
      await isMobileStaffEligible(this.prisma, this.settings, user);
    if (!eligible) return this.rejectCredentials(password);

    if (!await this.passwords.verify(password, user.passwordHash ?? DUMMY_PASSWORD_HASH)) {
      await this.recordStaffFailure(user);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.failedLoginAttempts > 0 || user.lockedUntil !== null) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }
    return this.staffTokens.issueTokenPair(user, { isSuperAdmin: user.isSuperAdmin }, undefined, RefreshTokenSource.MOBILE);
  }

  // Same lockout semantics as the dashboard LoginHandler (atomic increment, 5 strikes, 15 minutes).
  private async recordStaffFailure(user: Pick<User, 'id'>): Promise<void> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (updated.failedLoginAttempts >= STAFF_MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + STAFF_LOCKOUT_MINUTES * 60 * 1000) },
      });
    }
  }
}
