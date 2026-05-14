import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface EmployeeStatsResult {
  total: number;
  active: number;
  inactive: number;
  avgRating: number | null;
}

@Injectable()
export class EmployeeStatsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<EmployeeStatsResult> {
    const [total, active, ratingAgg] = await Promise.all([
      this.prisma.employee.count({ where: {} }),
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.rating.aggregate({
        _avg: { score: true },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      avgRating: ratingAgg._avg?.score ?? null,
    };
  }
}
