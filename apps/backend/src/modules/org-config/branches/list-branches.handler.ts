import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListBranchesDto } from './list-branches.dto';

export type ListBranchesQuery = ListBranchesDto;

@Injectable()
export class ListBranchesHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: ListBranchesQuery) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BranchWhereInput = {
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    if (dto.search) {
      const search = dto.search.trim();
      if (search) {
        where.OR = [
          { nameAr: { contains: search, mode: 'insensitive' } },
          { nameEn: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    const [items, total] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.branch.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        tx.branch.count({ where }),
      ]),
    );

    return toListResponse(items, total, page, limit);
  }
}
