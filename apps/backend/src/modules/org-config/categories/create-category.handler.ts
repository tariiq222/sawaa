import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateCategoryDto } from './create-category.dto';

export type CreateCategoryCommand = CreateCategoryDto;

@Injectable()
export class CreateCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CreateCategoryCommand) {
    return this.prisma.serviceCategory.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        departmentId: dto.departmentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
