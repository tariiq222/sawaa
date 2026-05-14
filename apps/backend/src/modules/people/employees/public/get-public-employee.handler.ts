import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import type { PublicEmployeeItem } from './list-public-employees.handler';

@Injectable()
export class GetPublicEmployeeHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(key: string): Promise<PublicEmployeeItem> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const row = await this.prisma.employee.findFirst({
      where: {
        ...(isUuid ? { id: key } : { slug: key }),
        isPublic: true,
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        nameAr: true,
        nameEn: true,
        title: true,
        specialty: true,
        specialtyAr: true,
        publicBioAr: true,
        publicBioEn: true,
        publicImageUrl: true,
        gender: true,
        employmentType: true,
      },
    });
    if (!row) throw new NotFoundException('Employee not found');

    const ratings = await this.prisma.rating.aggregate({
      where: { employeeId: row.id, isPublic: true },
      _avg: { score: true },
      _count: { _all: true },
    });

    const links = await this.prisma.employeeService.findMany({
      where: { employeeId: row.id },
      select: { serviceId: true },
    });
    const serviceIds = links.map((l) => l.serviceId);
    const services =
      serviceIds.length > 0
        ? await this.prisma.service.findMany({
            where: { id: { in: serviceIds }, isActive: true },
            select: { price: true },
          })
        : [];
    const prices = services.map((s) => parseFloat(String(s.price)));

    const todayAvailability = await this.prisma.employeeAvailability.findMany({
      where: { employeeId: row.id, isActive: true, dayOfWeek: new Date().getDay() },
    });

    return {
      ...row,
      gender: row.gender ?? null,
      ratingAverage: ratings._avg.score ?? null,
      ratingCount: ratings._count._all,
      minServicePrice: prices.length > 0 ? Math.min(...prices) : null,
      isAvailableToday: todayAvailability.length > 0,
    };
  }
}
