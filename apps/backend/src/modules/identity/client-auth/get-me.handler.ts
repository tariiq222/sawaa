import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface ClientProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  emailVerified: Date | null;
  phoneVerified: Date | null;
  accountType: string;
  claimedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class GetMeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(clientId: string): Promise<ClientProfile> {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        accountType: true,
        claimedAt: true,
        createdAt: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client as ClientProfile;
  }
}
