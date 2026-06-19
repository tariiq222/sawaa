import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { parseEntityRef } from '../../../common/parse-entity-ref';
import { mapEmployeeRow } from './employee-row.mapper';

export interface GetEmployeeQuery {
  employeeId: string;
}

@Injectable()
export class GetEmployeeHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetEmployeeQuery) {
    const idf = parseEntityRef(query.employeeId, 'EMP');
    const employee = await this.prisma.employee.findFirst({
      where: idf.kind === 'uuid' ? { id: idf.id } : { ref: idf.ref },
      include: {
        branches: true,
        services: true,
        availability: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
        exceptions: { orderBy: { startDate: 'asc' } },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const [ratingAgg, bookingCount] = await Promise.all([
      this.prisma.rating.aggregate({
        where: { employeeId: employee.id },
        _avg: { score: true },
        _count: { _all: true },
      }),
      this.prisma.booking.count({ where: { employeeId: employee.id } }),
    ]);

    return {
      ...mapEmployeeRow(
        employee,
        { avg: ratingAgg._avg.score, count: ratingAgg._count._all },
        bookingCount,
      ),
      exceptions: employee.exceptions,
    };
  }
}
