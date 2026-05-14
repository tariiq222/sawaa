import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface DeleteCategoryCommand {
  categoryId: string;
}

@Injectable()
export class DeleteCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute({ categoryId }: DeleteCategoryCommand) {
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId },
      include: { _count: { select: { services: true } } },
    });
    if (!existing) throw new NotFoundException('Category not found');
    if (existing._count?.services > 0) {
      throw new BadRequestException(
        'Category still has services; reassign or delete them first',
      );
    }
    return this.prisma.serviceCategory.delete({ where: { id: categoryId } });
  }
}
