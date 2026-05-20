import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteCategoryCommand {
  categoryId: string;
}

@Injectable()
export class DeleteCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute({ categoryId }: DeleteCategoryCommand) {
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const activeServiceCount = await this.prisma.service.count({
      where: { categoryId, archivedAt: null },
    });

    if (activeServiceCount > 0) {
      throw new BadRequestException(
        'Category still has services; reassign or delete them first',
      );
    }
    return this.prisma.serviceCategory.delete({ where: { id: categoryId } });
  }
}
