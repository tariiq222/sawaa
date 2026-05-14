import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { asPrismaJson } from '../../../common/prisma-json';
import { TenantContextService } from '../../../common/tenant';
import { UpsertIntegrationDto } from './upsert-integration.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type UpsertIntegrationCommand = UpsertIntegrationDto;

@Injectable()
export class UpsertIntegrationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: UpsertIntegrationCommand) {
    const _organizationId = DEFAULT_ORGANIZATION_ID;
    return this.prisma.integration.upsert({
      where: { provider: cmd.provider },
      create: {
        provider: cmd.provider,
        config: asPrismaJson(cmd.config),
        isActive: cmd.isActive ?? true,
      },
      update: { config: asPrismaJson(cmd.config), isActive: cmd.isActive ?? true },
    });
  }
}
