import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class GetChatbotConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  /**
   * SaaS-02f: ChatbotConfig is now an org-unique singleton.
   * Upsert-on-read: the first call per org lazily creates the row.
   * Mirrors BrandingConfig (02c).
   */
  async execute() {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    return this.prisma.chatbotConfig.upsert({
      where: { organizationId },
      update: {},
      create: {},
    });
  }
}
