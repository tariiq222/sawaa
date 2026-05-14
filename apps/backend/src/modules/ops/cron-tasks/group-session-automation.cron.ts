import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';

@Injectable()
export class GroupSessionAutomationCron {
  private readonly logger = new Logger(GroupSessionAutomationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async execute(): Promise<void> {
    await this.cls.run(async () => {
      this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      const now = new Date();
      const result = await this.prisma.$allTenants.groupSession.updateMany({
        where: {
          status: 'OPEN',
          scheduledAt: { lte: now },
        },
        data: { status: 'COMPLETED' },
      });
      if (result.count > 0) {
        this.logger.log(`closed ${result.count} group sessions`);
      }
    });
  }
}
