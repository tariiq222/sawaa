import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListGroupProgramsQuery {
  activeOnly?: boolean;
  departmentId?: string;
}

@Injectable()
export class ListGroupProgramsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListGroupProgramsQuery = {}) {
    const where: Record<string, unknown> = {};
    if (query.activeOnly) where['isActive'] = true;
    if (query.departmentId) where['departmentId'] = query.departmentId;

    return this.prisma.groupProgram.findMany({
      where,
      select: {
        id: true, ref: true, nameAr: true, nameEn: true, departmentId: true,
        minParticipants: true, maxParticipants: true, defaultPrice: true,
        isActive: true, descriptionAr: true, descriptionEn: true,
      },
      orderBy: { ref: 'asc' },
    });
  }
}
