import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Client, OtpPurpose, OtpChannel, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { OtpSessionService } from '../../otp/otp-session.service';
import { PasswordService } from '../../shared/password.service';
import { ResetPasswordDto } from './reset-password.dto';
import { maskIdentifier } from '../../../../common/helpers/mask-pii.helper';
import { PasswordHistoryService } from '../shared/password-history.service';
import { normalizeIdentifier } from '../../shared/identifier-detector';
import { SINGLE_TENANT_CONTEXT_ID } from '../../../../common/constants';

@Injectable()
export class ResetPasswordHandler {
  private readonly logger = new Logger(ResetPasswordHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly otpSession: OtpSessionService,
    private readonly passwords: PasswordService,
    private readonly passwordHistory: PasswordHistoryService,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<void> {
    const session = this.otpSession.verifySession(dto.sessionToken);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (session.purpose !== OtpPurpose.CLIENT_PASSWORD_RESET) {
      throw new UnauthorizedException('Invalid session purpose');
    }

    const now = new Date();
    const expiresAt = session.exp
      ? new Date(session.exp * 1000)
      : new Date(now.getTime() + 30 * 60 * 1000);

    const organizationId = SINGLE_TENANT_CONTEXT_ID;

    const identifier = session.identifier;
    const isEmail = session.channel === OtpChannel.EMAIL;
    const existing = isEmail
      ? await this.resolveEmailClient(normalizeIdentifier(identifier, 'EMAIL'))
      : await this.prisma.client.findFirst({ where: { phone: identifier, deletedAt: null } });

    if (!existing) {
      throw new UnauthorizedException('Invalid session');
    }

    await this.passwordHistory.assertNotReused(
      existing.id,
      organizationId,
      dto.newPassword,
      existing.passwordHash,
    );

    const passwordHash = await this.passwords.hash(dto.newPassword);

    await this.rlsTransaction.withTransaction(async (tx) => {
      // Match the identity flows' User -> Client lock order. Hashing happens
      // before these locks; revalidate the proof against the current records.
      if (existing.userId) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${existing.userId} FOR UPDATE`);
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${existing.id} FOR UPDATE`);
      const current = await tx.client.findUnique({ where: { id: existing.id } });
      if (!current || !current.isActive || current.deletedAt || current.userId !== existing.userId) {
        throw new UnauthorizedException('Invalid session');
      }
      if (isEmail) {
        const resolved = await this.resolveEmailClient(normalizeIdentifier(identifier, 'EMAIL'), tx);
        if (resolved.id !== current.id) throw new UnauthorizedException('Invalid session');
      } else if (current.phone !== identifier) {
        throw new UnauthorizedException('Invalid session');
      }

      // Burn OTP session — unique constraint on jti prevents replay
      try {
        await tx.usedOtpSession.create({
          data: {
            jti: session.jti,
            consumedAt: now,
            expiresAt,
          },
        });
      } catch {
        throw new UnauthorizedException('Session already used');
      }

      // Update password. Bump tokenVersion in the same update so any client
      // access token issued before the reset is immediately invalidated by
      // ClientJwtStrategy (which compares Client.tokenVersion to the JWT claim).
      await tx.client.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          // The single-use reset session proves ownership of this channel only.
          ...(isEmail
            ? (current.email ? { emailVerified: now } : {})
            : { phoneVerified: now }),
          loginAttempts: 0,
          lockoutUntil: null,
          tokenVersion: { increment: 1 },
        },
      });

      // Record new password in history (trims to HISTORY_DEPTH)
      await this.passwordHistory.record(tx, existing.id, organizationId, passwordHash);

      // Revoke all existing refresh tokens for this client
      await tx.clientRefreshToken.updateMany({
        where: { clientId: existing.id, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    this.logger.log(`Password reset completed for session identifier: ${maskIdentifier(session.identifier)}`);
  }

  private async resolveEmailClient(
    email: string,
    store: Pick<Prisma.TransactionClient, 'user' | 'client'> = this.prisma,
  ): Promise<Client> {
    const users = await store.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (users.length > 1) throw new UnauthorizedException('Invalid session');
    const user = users[0];
    const clients = await store.client.findMany({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          ...(user ? [{ userId: user.id }] : []),
        ],
      },
    });
    if (clients.length !== 1) throw new UnauthorizedException('Invalid session');
    const client = clients[0];
    if (!client.isActive || client.deletedAt ||
        (client.email && normalizeIdentifier(client.email, 'EMAIL') !== email)) {
      throw new UnauthorizedException('Invalid session');
    }
    if (user) {
      if (!user.isActive || user.role !== 'CLIENT' || user.isSuperAdmin || client.userId !== user.id ||
          (user.phone && client.phone && user.phone !== client.phone)) {
        throw new UnauthorizedException('Invalid session');
      }
    } else if (client.userId) {
      throw new UnauthorizedException('Invalid session');
    }
    // A new email OTP alone must not promote an unverified User-only email:
    // that identity still needs the existing email-entry phone proof flow.
    if (!client.email && !user?.emailVerifiedAt) throw new UnauthorizedException('Invalid session');
    return client;
  }
}
