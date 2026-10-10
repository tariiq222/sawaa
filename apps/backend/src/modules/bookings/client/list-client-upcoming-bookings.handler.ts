import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { mapBookingRow } from '../booking-row.mapper';
import { PrismaService } from '../../../infrastructure/database';

const UPCOMING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID];

export interface ListClientUpcomingBookingsCommand {
  clientId: string;
  page?: number;
  limit?: number;
  now?: Date;
}

export interface ListClientUpcomingBookingsResult {
  data: ReturnType<typeof mapBookingRow>[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class ListClientUpcomingBookingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListClientUpcomingBookingsCommand): Promise<ListClientUpcomingBookingsResult> {
    const page = cmd.page ?? 1;
    const limit = cmd.limit ?? 10;
    const now = cmd.now ?? new Date();
    const where = {
      clientId: cmd.clientId,
      scheduledAt: { gt: now },
      endsAt: { gt: now },
      status: { in: UPCOMING_STATUSES },
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const employeeIds = [...new Set(data.map((booking) => booking.employeeId))];
    const serviceIds = [...new Set(data.flatMap((booking) => booking.serviceId ? [booking.serviceId] : []))];
    const [employees, services] = await Promise.all([
      employeeIds.length ? this.prisma.employee.findMany({ where: { id: { in: employeeIds } } }) : [],
      serviceIds.length ? this.prisma.service.findMany({ where: { id: { in: serviceIds } } }) : [],
    ]);
    const relations = {
      clientsById: new Map(),
      employeesById: new Map(employees.map((employee) => [employee.id, employee])),
      servicesById: new Map(services.map((service) => [service.id, service])),
      paymentsByBookingId: new Map(),
    };
    return { data: data.map((booking) => mapBookingRow(booking, relations)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
