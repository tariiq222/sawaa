import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { parseEntityRef } from '../../../common/parse-entity-ref';

export interface GetGroupSessionQuery {
  groupSessionId: string;
}

export interface GroupSessionEnrollmentResult {
  clientId: string;
  bookingId: string;
  enrolledAt: Date;
  client: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
  booking: {
    id: string;
    status: string;
    bookingType: string;
    deliveryType: string;
    checkedInAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    confirmedAt: Date | null;
  } | null;
}

export interface GroupSessionServiceResult {
  nameAr: string;
  nameEn: string | null;
}

export interface GroupSessionEmployeeResult {
  name: string;
  nameAr: string | null;
  nameEn: string | null;
}

@Injectable()
export class GetGroupSessionHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetGroupSessionQuery) {
    const ref = parseEntityRef(query.groupSessionId, 'GS');
    const where = ref.kind === 'uuid' ? { id: ref.id } : { ref: ref.ref };

    const session = await this.prisma.groupSession.findUnique({
      where,
      include: {
        enrollments: {
          select: {
            clientId: true,
            bookingId: true,
            enrolledAt: true,
            booking: {
              select: {
                id: true,
                status: true,
                bookingType: true,
                deliveryType: true,
                checkedInAt: true,
                completedAt: true,
                cancelledAt: true,
                confirmedAt: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`GroupSession ${query.groupSessionId} not found`);
    }

    // Client has no Prisma relation on GroupEnrollment (cross-BC plain string IDs).
    // Resolve all clients in a single query, then map by ID.
    const clientIds = [...new Set(session.enrollments.map((e) => e.clientId))];
    const clientsRaw = clientIds.length
      ? await this.prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        })
      : [];

    const clientById = new Map(clientsRaw.map((c) => [c.id, c]));

    const [service, employee] = await Promise.all([
      this.prisma.service.findUnique({
        where: { id: session.serviceId },
        select: { nameAr: true, nameEn: true },
      }),
      this.prisma.employee.findUnique({
        where: { id: session.employeeId },
        select: { name: true, nameAr: true, nameEn: true },
      }),
    ]);

    const spotsLeft = session.maxCapacity - session.enrolledCount;

    const enrollments: GroupSessionEnrollmentResult[] = session.enrollments.map((e) => ({
      clientId: e.clientId,
      bookingId: e.bookingId,
      enrolledAt: e.enrolledAt,
      client: clientById.get(e.clientId) ?? null,
      booking: e.booking,
    }));

    return {
      ...session,
      price: Number(session.price),
      enrollments,
      service: service as GroupSessionServiceResult | null,
      employee: employee as GroupSessionEmployeeResult | null,
      spotsLeft,
    };
  }
}
