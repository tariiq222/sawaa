import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateContactMessageDto } from './create-contact-message.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class CreateContactMessageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateContactMessageDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Either phone or email is required');
    }

    // SaaS-02f: public endpoint — tenant is resolved by TenantResolverMiddleware
    // (Host-based) before this handler runs. Fall back to DEFAULT_ORG if middleware
    // didn't set CLS (single-tenant legacy deployments).
    const _organizationId = DEFAULT_ORGANIZATION_ID;

    return this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        subject: dto.subject,
        body: dto.body,
      },
      select: { id: true, createdAt: true, status: true },
    });
  }
}
