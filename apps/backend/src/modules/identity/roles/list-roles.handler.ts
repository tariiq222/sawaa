import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListRolesHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute() {
    return this.prisma.customRole.findMany({
      include: { permissions: true },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
  }
}
