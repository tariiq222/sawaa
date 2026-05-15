import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { PasswordService } from '../../shared/password.service';

export const PASSWORD_HISTORY_DEPTH = 5;
const PASSWORD_REUSED_ERROR = 'PASSWORD_REUSED';

@Injectable()
export class PasswordHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async assertNotReused(
    clientId: string,
    organizationId: string,
    plainPassword: string,
    currentHash: string | null,
  ): Promise<void> {
    if (currentHash && (await this.passwords.verify(plainPassword, currentHash))) {
      throw new BadRequestException(PASSWORD_REUSED_ERROR);
    }
    const history = await this.prisma.passwordHistory.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_DEPTH,
    });
    for (const row of history) {
      if (await this.passwords.verify(plainPassword, row.passwordHash)) {
        throw new BadRequestException(PASSWORD_REUSED_ERROR);
      }
    }
  }

  async record(
    tx: Prisma.TransactionClient,
    clientId: string,
    organizationId: string,
    passwordHash: string,
  ): Promise<void> {
    await tx.passwordHistory.create({
      data: { clientId, passwordHash },
    });
    const surplus = await tx.passwordHistory.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      skip: PASSWORD_HISTORY_DEPTH,
      select: { id: true },
    });
    if (surplus.length > 0) {
      await tx.passwordHistory.deleteMany({
        where: { id: { in: surplus.map((r) => r.id) } },
      });
    }
  }
}
