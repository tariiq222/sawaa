import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';
import { assertCanAssignRole } from '../shared/role-rank';
import { CreateUserDto } from './create-user.dto';

// actorUserId is injected from the authenticated principal (req.user.id) by the
// controller — never a client-supplied body field. Keep it off the DTO so the
// ValidationPipe whitelist cannot accept it from the request body.
export type CreateUserCommand = CreateUserDto & { actorUserId: string };

@Injectable()
export class CreateUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly password: PasswordService,
  ) {}

  async execute(cmd: CreateUserCommand) {
    // Rank gate: an actor may not create an account at or above their own rank
    // (and only a super admin may mint SUPER_ADMIN). Custom-role permissions are
    // bounded elsewhere, so only the built-in role needs the rank check here.
    const actor = await this.prisma.user.findUnique({
      where: { id: cmd.actorUserId },
      select: { role: true, isSuperAdmin: true },
    });
    if (!actor) throw new ForbiddenException('Actor not found');
    assertCanAssignRole(actor, cmd.role);

    const existing = await this.prisma.user.findUnique({
      where: { email: cmd.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await this.password.hash(cmd.password);
    return this.rlsTransaction.withTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: cmd.email,
          passwordHash,
          name: cmd.name,
          role: cmd.role,
          phone: cmd.phone,
          gender: cmd.gender,
          customRoleId: cmd.customRoleId,
        },
        omit: { passwordHash: true },
      });

      return user;
    });
  }
}
