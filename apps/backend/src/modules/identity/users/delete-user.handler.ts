import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface DeleteUserCommand {
  userId: string;
}

@Injectable()
export class DeleteUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: DeleteUserCommand): Promise<void> {
    const { count } = await this.prisma.user.deleteMany({
      where: { id: cmd.userId },
    });
    if (count === 0) throw new NotFoundException(`User ${cmd.userId} not found`);
  }
}
