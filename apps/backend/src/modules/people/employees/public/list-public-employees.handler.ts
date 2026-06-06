import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface PublicEmployeeItem {
  id: string;
  slug: string | null;
  nameAr: string | null;
  nameEn: string | null;
  title: string | null;
  specialty: string | null;
  specialtyAr: string | null;
  publicBioAr: string | null;
  publicBioEn: string | null;
  publicImageUrl: string | null;
  gender: string | null;
  employmentType: string;
  ratingAverage: number | null;
  ratingCount: number;
  minServicePrice: number | null;
  isAvailableToday: boolean;
  /** Service ids this employee is configured to deliver. Empty = unbookable online. */
  serviceIds: string[];
  /** Branch ids this employee works from. Empty = unbookable. */
  branchIds: string[];
  /** True only if employee has ≥1 service, ≥1 branch, and ≥1 active availability rule. */
  isBookable: boolean;
  /** Days of week (0=Sun..6=Sat) with an active availability rule. Used by the FE strip to grey out unbookable days. */
  availableDaysOfWeek: number[];
  /** Synthetic user shape so FE (which shares EmployeeWithUser typing) renders names + avatar. */
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  /** Public-facing rating + experience fields shared with dashboard EmployeeWithUser. */
  rating: number;
  reviewCount: number;
  experience: number;
}

@Injectable()
export class ListPublicEmployeesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PublicEmployeeItem[]> {
    const rows = await this.prisma.employee.findMany({
      where: { isPublic: true, isActive: true },
      orderBy: { createdAt: 'desc' },
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

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const todayDow = new Date().getDay();

    const [ratings, employeeServiceLinks, employeeBranchLinks, availabilitiesToday, anyAvailabilities] = await Promise.all([
      this.prisma.rating.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: ids }, isPublic: true },
        _avg: { score: true },
        _count: { _all: true },
      }),
      this.prisma.employeeService.findMany({
        where: { employeeId: { in: ids } },
        select: { employeeId: true, serviceId: true },
      }),
      this.prisma.employeeBranch.findMany({
        where: { employeeId: { in: ids } },
        select: { employeeId: true, branchId: true },
      }),
      this.prisma.employeeAvailability.findMany({
        where: { employeeId: { in: ids }, isActive: true, dayOfWeek: todayDow },
        select: { employeeId: true },
      }),
      this.prisma.employeeAvailability.findMany({
        where: { employeeId: { in: ids }, isActive: true },
        select: { employeeId: true, dayOfWeek: true },
      }),
    ]);

    // Fetch public-bookable services and active branches for all linked ids.
    const serviceIds = [...new Set(employeeServiceLinks.map((l) => l.serviceId))];
    const services =
      serviceIds.length > 0
        ? await this.prisma.service.findMany({
            where: { id: { in: serviceIds }, isActive: true, isHidden: false, archivedAt: null },
            select: { id: true, price: true },
          })
        : [];
    const activeServiceIds = new Set(services.map((s) => s.id));
    const priceByServiceId = new Map(services.map((s) => [s.id, parseFloat(String(s.price))]));

    const linkedBranchIds = [...new Set(employeeBranchLinks.map((l) => l.branchId))];
    const activeBranches =
      linkedBranchIds.length > 0
        ? await this.prisma.branch.findMany({
            where: { id: { in: linkedBranchIds }, isActive: true },
            select: { id: true },
          })
        : [];
    const activeBranchIds = new Set(activeBranches.map((b) => b.id));

    // Group prices by employee
    const pricesByEmployee = new Map<string, number[]>();
    for (const link of employeeServiceLinks) {
      const price = priceByServiceId.get(link.serviceId);
      if (price === undefined) continue;
      if (!pricesByEmployee.has(link.employeeId)) pricesByEmployee.set(link.employeeId, []);
      pricesByEmployee.get(link.employeeId)!.push(price);
    }

    const byEmployee = new Map(
      ratings.map((r) => [r.employeeId, { avg: r._avg.score ?? null, count: r._count._all }]),
    );
    const availableToday = new Set(availabilitiesToday.map((a) => a.employeeId));
    const hasAnyAvailability = new Set(anyAvailabilities.map((a) => a.employeeId));
    const availableDaysByEmployee = new Map<string, Set<number>>();
    for (const a of anyAvailabilities) {
      if (!availableDaysByEmployee.has(a.employeeId)) availableDaysByEmployee.set(a.employeeId, new Set());
      availableDaysByEmployee.get(a.employeeId)!.add(a.dayOfWeek);
    }

    const servicesByEmployee = new Map<string, string[]>();
    for (const link of employeeServiceLinks) {
      if (!activeServiceIds.has(link.serviceId)) continue;
      if (!servicesByEmployee.has(link.employeeId)) servicesByEmployee.set(link.employeeId, []);
      servicesByEmployee.get(link.employeeId)!.push(link.serviceId);
    }
    const branchesByEmployee = new Map<string, string[]>();
    for (const link of employeeBranchLinks) {
      if (!activeBranchIds.has(link.branchId)) continue;
      if (!branchesByEmployee.has(link.employeeId)) branchesByEmployee.set(link.employeeId, []);
      branchesByEmployee.get(link.employeeId)!.push(link.branchId);
    }

    return rows.map((r) => {
      const stat = byEmployee.get(r.id);
      const prices = pricesByEmployee.get(r.id) ?? [];
      const serviceIds = servicesByEmployee.get(r.id) ?? [];
      const branchIds = branchesByEmployee.get(r.id) ?? [];
      // Split the display name into first + last so legacy consumers that read
      // user.firstName/user.lastName render correctly. AR takes precedence; EN
      // is a fallback. The split is best-effort — if there's only one token,
      // the whole name goes into firstName.
      const display = r.nameAr ?? r.nameEn ?? '';
      const tokens = display.trim().split(/\s+/).filter(Boolean);
      const firstName = tokens.length > 0 ? tokens[0] : '';
      const lastName = tokens.length > 1 ? tokens.slice(1).join(' ') : '';
      return {
        ...r,
        experience: r.experience ?? 0,
        gender: r.gender ?? null,
        ratingAverage: stat?.avg ?? null,
        ratingCount: stat?.count ?? 0,
        minServicePrice: prices.length > 0 ? Math.min(...prices) : null,
        isAvailableToday: availableToday.has(r.id),
        serviceIds,
        branchIds,
        isBookable: serviceIds.length > 0 && branchIds.length > 0 && hasAnyAvailability.has(r.id),
        availableDaysOfWeek: Array.from(availableDaysByEmployee.get(r.id) ?? []).sort((a, b) => a - b),
        rating: stat?.avg ?? 0,
        reviewCount: stat?.count ?? 0,
        user: {
          id: r.id,
          firstName,
          lastName,
          email: '',
          phone: null,
          avatarUrl: r.publicImageUrl,
        },
      };
    });
  }
}
