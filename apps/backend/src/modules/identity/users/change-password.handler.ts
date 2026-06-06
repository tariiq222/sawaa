import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';

export interface ChangePasswordCommand {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class ChangePasswordHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly password: PasswordService,
  ) {}

  async execute(cmd: ChangePasswordCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: cmd.userId } });
    if (!user) throw new NotFoundException('User not found');

    // passwordHash became nullable when mobile OTP-only auth landed — a passwordless
    // mobile-first user reaching this dashboard endpoint must set a password first
    // (different flow), not change one.
    if (!user.passwordHash) throw new BadRequestException('Current password is incorrect');

    const isValid = await this.password.verify(cmd.currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    const newHash = await this.password.hash(cmd.newPassword);
    const now = new Date();

    await this.rlsTransaction.withTransaction(async (tx) => {
      await tx.user.update({
        where: { id: cmd.userId },
        data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({
        where: { userId: cmd.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }
}
