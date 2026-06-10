import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetMainBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute() {
    const mainBranch = await this.prisma.branch.findFirst({ where: { isMain: true } });
    if (!mainBranch) throw new NotFoundException('No main branch configured');
    return mainBranch;
  }
}
