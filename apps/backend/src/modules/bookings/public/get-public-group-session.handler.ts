import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface PublicGroupSessionDetail {
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
  isPublic: boolean;
  waitlistEnabled: boolean;
  waitlistCount: number;
  employeeId: string;
  serviceId: string;
  branchId: string;
  spotsLeft: number;
  isFull: boolean;
  isWaitlistOnly: boolean;
}

@Injectable()
export class GetPublicGroupSessionHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(groupSessionId: string): Promise<PublicGroupSessionDetail> {
    const session = await this.prisma.groupSession.findFirst({
      where: {
        id: groupSessionId,
        isPublic: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Group session not found');
    }

    const spotsLeft = session.maxCapacity - session.enrolledCount;

    return {
      ...session,
      price: Number(session.price),
      spotsLeft,
      isFull: spotsLeft <= 0,
      isWaitlistOnly: spotsLeft <= 0 && session.waitlistEnabled,
    };
  }
}