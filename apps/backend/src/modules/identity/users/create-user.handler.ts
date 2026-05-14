import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';
import { CreateUserDto } from './create-user.dto';

export type CreateUserCommand = CreateUserDto;

@Injectable()
export class CreateUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly rlsTx: RlsTransactionService,
  ) {}

  async execute(cmd: CreateUserCommand) {
    const existing = await this.prisma.user.findUnique({
      where: { email: cmd.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await this.password.hash(cmd.password);
    return this.rlsTx.withTransaction(async (tx) => {
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
