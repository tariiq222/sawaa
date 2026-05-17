import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type ArchiveBundleCommand = { bundleId: string };

@Injectable()
export class ArchiveBundleHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ArchiveBundleCommand) {
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id: dto.bundleId, archivedAt: null },
    });
    if (!bundle) throw new NotFoundException('Bundle not found');

    return this.prisma.serviceBundle.update({
      where: { id: dto.bundleId },
      data: { archivedAt: new Date(), isActive: false },
    });
  }
}
