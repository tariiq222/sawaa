import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateContactMessageDto } from './create-contact-message.dto';
import { CAPTCHA_VERIFIER, type CaptchaVerifier } from './captcha.verifier';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class CreateContactMessageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    @Inject(CAPTCHA_VERIFIER) private readonly captcha: CaptchaVerifier,
  ) {}

  async execute(dto: CreateContactMessageDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Either phone or email is required');
    }

    const ok = await this.captcha.verify(dto.captchaToken);
    if (!ok) throw new UnauthorizedException('Captcha verification failed');

    // SaaS-02f: public endpoint — tenant is resolved by TenantResolverMiddleware
    // (Host-based) before this handler runs. Fall back to DEFAULT_ORG if middleware
    // didn't set CLS (single-tenant legacy deployments).
    const organizationId = DEFAULT_ORGANIZATION_ID;

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
