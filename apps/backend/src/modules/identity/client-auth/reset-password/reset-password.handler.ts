import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { OtpPurpose, OtpChannel } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { OtpSessionService } from '../../otp/otp-session.service';
import { PasswordService } from '../../shared/password.service';
import { ResetPasswordDto } from './reset-password.dto';
import { maskIdentifier } from '../../../../common/helpers/mask-pii.helper';
import { PasswordHistoryService } from '../shared/password-history.service';
import { DEFAULT_ORG_ID } from '../../../../common/constants';

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

    const organizationId = session.organizationId ?? DEFAULT_ORG_ID;

    const identifier = session.identifier;
    const isEmail = session.channel === OtpChannel.EMAIL;
    const existing = isEmail
      ? await this.prisma.client.findFirst({ where: { email: identifier, deletedAt: null } })
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
        data: { passwordHash, loginAttempts: 0, lockoutUntil: null, tokenVersion: { increment: 1 } },
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
}
