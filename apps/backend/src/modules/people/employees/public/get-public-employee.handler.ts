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
        experience: true,
      },
    });
    if (!row) throw new NotFoundException('Employee not found');

    const [ratings, links, branches, anyAvail, todayAvailability] = await Promise.all([
      this.prisma.rating.aggregate({
        where: { employeeId: row.id, isPublic: true },
        _avg: { score: true },
        _count: { _all: true },
      }),
      this.prisma.employeeService.findMany({
        where: { employeeId: row.id },
        select: { serviceId: true },
      }),
      this.prisma.employeeBranch.findMany({
        where: { employeeId: row.id },
        select: { branchId: true },
      }),
      this.prisma.employeeAvailability.findMany({
        where: { employeeId: row.id, isActive: true },
        select: { id: true, dayOfWeek: true },
      }),
      this.prisma.employeeAvailability.findMany({
        where: { employeeId: row.id, isActive: true, dayOfWeek: new Date().getDay() },
        select: { id: true },
      }),
    ]);

    const serviceIds = links.map((l) => l.serviceId);
    const branchIds = branches.map((b) => b.branchId);
    const services =
      serviceIds.length > 0
        ? await this.prisma.service.findMany({
            where: { id: { in: serviceIds }, isActive: true },
            select: { price: true },
          })
        : [];
    const prices = services.map((s) => parseFloat(String(s.price)));

    const display = row.nameAr ?? row.nameEn ?? '';
    const tokens = display.trim().split(/\s+/).filter(Boolean);
    const firstName = tokens.length > 0 ? tokens[0] : '';
    const lastName = tokens.length > 1 ? tokens.slice(1).join(' ') : '';

    return {
      ...row,
      experience: row.experience ?? 0,
      gender: row.gender ?? null,
      ratingAverage: ratings._avg.score ?? null,
      ratingCount: ratings._count._all,
      minServicePrice: prices.length > 0 ? Math.min(...prices) : null,
      isAvailableToday: todayAvailability.length > 0,
      serviceIds,
      branchIds,
      isBookable: serviceIds.length > 0 && branchIds.length > 0 && anyAvail.length > 0,
      availableDaysOfWeek: Array.from(new Set(anyAvail.map((a) => a.dayOfWeek))).sort((a, b) => a - b),
      rating: ratings._avg.score ?? 0,
      reviewCount: ratings._count._all,
      user: {
        id: row.id,
        firstName,
        lastName,
        email: '',
        phone: null,
        avatarUrl: row.publicImageUrl,
      },
    };
  }
}
