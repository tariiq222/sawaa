import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface PublicGroupSession {
  id: string;
  title: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  scheduledAt: Date;
  durationMins: number;
  maxCapacity: number;
  enrolledCount: number;
  price: number;
  currency: string;
  status: string;
  waitlistEnabled: boolean;
  waitlistCount: number;
  employeeId: string;
  serviceId: string;
  spotsLeft: number;
  isFull: boolean;
  isWaitlistOnly: boolean;
}

@Injectable()
export class ListPublicGroupSessionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(branchId?: string): Promise<PublicGroupSession[]> {
    const now = new Date();

    const where: Record<string, unknown> = {
      isPublic: true,
      status: 'OPEN',
      scheduledAt: { gte: now },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    const sessions = await this.prisma.groupSession.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        title: true,
        descriptionAr: true,
        descriptionEn: true,
        scheduledAt: true,
        durationMins: true,
        maxCapacity: true,
        enrolledCount: true,
        price: true,
        currency: true,
        status: true,
        waitlistEnabled: true,
        waitlistCount: true,
        employeeId: true,
        serviceId: true,
      },
    });

    return sessions.map((session) => {
      const spotsLeft = session.maxCapacity - session.enrolledCount;
      return {
        ...session,
        price: Number(session.price),
        spotsLeft,
        isFull: spotsLeft <= 0,
        isWaitlistOnly: spotsLeft <= 0 && session.waitlistEnabled,
      };
    });
  }
}