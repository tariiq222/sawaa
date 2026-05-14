import { Injectable, Logger } from '@nestjs/common';
import { WaitlistStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

@Injectable()
export class AppointmentRemindersCron {
  private readonly logger = new Logger(AppointmentRemindersCron.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<void> {
    await withCronLeader(this.prisma, 'appointment-reminders', async () => {
      const waiting = await this.prisma.waitlistEntry.findMany({
        where: { status: WaitlistStatus.WAITING },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      if (waiting.length > 0) {
        this.logger.log(`${waiting.length} waitlist entries checked`);
      }
    });
  }
}
