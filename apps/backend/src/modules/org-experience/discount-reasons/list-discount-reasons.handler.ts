import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListDiscountReasonsCommand {
  /** When true, include inactive reasons (settings management view). */
  includeInactive?: boolean;
}

@Injectable()
export class ListDiscountReasonsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListDiscountReasonsCommand = {}) {
    return this.prisma.discountReason.findMany({
      where: cmd.includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
