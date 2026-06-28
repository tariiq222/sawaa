import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserGender } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { assertCanManageUser } from '../shared/role-rank';

export interface UpdateUserCommand {
  actorUserId: string;
  userId: string;
  email?: string;
  name?: string;
  phone?: string;
  gender?: UserGender;
  avatarUrl?: string;
  isActive?: boolean;
  // SECURITY (P0-2): role and customRoleId removed from this command.
  // Role changes go through UpdateUserRoleHandler with explicit rank check.
}

@Injectable()
export class UpdateUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: UpdateUserCommand) {
    const [actor, user] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: cmd.actorUserId },
        select: { id: true, role: true, isSuperAdmin: true },
      }),
      this.prisma.user.findUnique({
        where: { id: cmd.userId },
        select: { id: true, role: true, isSuperAdmin: true },
      }),
    ]);
    if (!actor) throw new ForbiddenException('Actor not found');
    if (!user) throw new NotFoundException('User not found');

    assertCanManageUser(actor, user);

    return this.rlsTransaction.withTransaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: cmd.userId },
        data: {
          email: cmd.email,
          name: cmd.name,
          phone: cmd.phone,
          gender: cmd.gender,
          avatarUrl: cmd.avatarUrl,
          isActive: cmd.isActive,
        },
        omit: { passwordHash: true },
      });

      return updated;
    });
  }
}
