import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateProblemReportDto } from './create-problem-report.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type CreateProblemReportCommand = CreateProblemReportDto;

@Injectable()
export class CreateProblemReportHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: CreateProblemReportCommand) {
    const _organizationId = DEFAULT_ORGANIZATION_ID;
    return this.prisma.problemReport.create({
      data: {
        reporterId: cmd.reporterId,
        type: cmd.type,
        title: cmd.title,
        description: cmd.description,
      },
    });
  }
}
