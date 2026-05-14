import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateProblemReportStatusDto } from './update-problem-report-status.dto';

export type UpdateProblemReportStatusCommand = UpdateProblemReportStatusDto & {
  id: string;
};

@Injectable()
export class UpdateProblemReportStatusHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateProblemReportStatusCommand) {
    return this.prisma.problemReport.update({
      where: { id: cmd.id },
      data: { status: cmd.status, resolution: cmd.resolution },
    });
  }
}
