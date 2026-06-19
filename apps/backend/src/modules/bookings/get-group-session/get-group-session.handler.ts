import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetGroupSessionQuery {
  groupSessionId: string;
}

@Injectable()
export class GetGroupSessionHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetGroupSessionQuery) {
    const session = await this.prisma.groupSession.findUnique({
      where: { id: query.groupSessionId },
      include: {
        enrollments: {
          select: {
            clientId: true,
            bookingId: true,
            enrolledAt: true,
          },
        },
      },
    });
    if (!session) {
      throw new NotFoundException(`GroupSession ${query.groupSessionId} not found`);
    }
    return {
      ...session,
      price: Number(session.price),
      enrollments: session.enrollments,
    };
  }
}
