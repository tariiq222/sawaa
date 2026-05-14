import { Injectable, NotFoundException } from '@nestjs/common';
import { UserGender, UserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface UpdateUserCommand {
  userId: string;
  email?: string;
  name?: string;
  phone?: string;
  gender?: UserGender;
  role?: UserRole;
  customRoleId?: string | null;
  avatarUrl?: string;
  isActive?: boolean;
}

@Injectable()
export class UpdateUserHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: UpdateUserCommand) {
    const user = await this.prisma.user.findUnique({
      where: { id: cmd.userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: cmd.userId },
        data: {
          email: cmd.email,
          name: cmd.name,
          phone: cmd.phone,
          gender: cmd.gender,
          role: cmd.role,
          customRoleId: cmd.customRoleId,
          avatarUrl: cmd.avatarUrl,
          isActive: cmd.isActive,
        },
        omit: { passwordHash: true },
      });

      return updated;
    });
  }
}
