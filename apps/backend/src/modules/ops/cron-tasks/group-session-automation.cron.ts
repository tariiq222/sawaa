import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GroupSessionAutomationCron {
  private readonly logger = new Logger(GroupSessionAutomationCron.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.groupSession.updateMany({
      where: {
        status: 'OPEN',
        scheduledAt: { lte: now },
      },
      data: { status: 'COMPLETED' },
    });
    if (result.count > 0) {
      this.logger.log(`closed ${result.count} group sessions`);
    }
  }
}
