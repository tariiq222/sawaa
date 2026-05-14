import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { asPrismaJson } from '../../../common/prisma-json';
import { UpsertIntegrationDto } from './upsert-integration.dto';

export type UpsertIntegrationCommand = UpsertIntegrationDto;

@Injectable()
export class UpsertIntegrationHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: UpsertIntegrationCommand) {
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
