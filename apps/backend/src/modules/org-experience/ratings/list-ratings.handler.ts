import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListRatingsDto } from './list-ratings.dto';

export type ListRatingsCommand = ListRatingsDto;

@Injectable()
export class ListRatingsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: ListRatingsCommand) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(dto.employeeId && { employeeId: dto.employeeId }),
      ...(dto.clientId && { clientId: dto.clientId }),
    };

    const [items, total] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.rating.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        tx.rating.count({ where }),
      ]),
    );

    return toListResponse(items, total, page, limit);
  }
}
