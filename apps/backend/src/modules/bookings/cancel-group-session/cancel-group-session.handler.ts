import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CancelGroupSessionDto } from './cancel-group-session.dto';

export type CancelGroupSessionCommand = CancelGroupSessionDto & {
  groupSessionId: string;
};

@Injectable()
export class CancelGroupSessionHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CancelGroupSessionCommand) {
    const session = await this.prisma.groupSession.findUnique({
      where: { id: cmd.groupSessionId },
    });
    if (!session) {
      throw new NotFoundException(`GroupSession ${cmd.groupSessionId} not found`);
    }
    if (session.status === 'CANCELLED' || session.status === 'COMPLETED') {
      throw new BadRequestException(
        `Cannot cancel a session with status ${session.status}`,
      );
    }
    const updated = await this.prisma.groupSession.update({
      where: { id: cmd.groupSessionId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: cmd.cancelReason,
      },
    });
    return {
      id: updated.id,
      status: updated.status,
      cancelledAt: updated.cancelledAt,
      cancelReason: updated.cancelReason,
    };
  }
}
