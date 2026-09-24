import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { ClientLoginHandler } from '../client-auth/client-login.handler';
import { ReviewLoginDto } from './review-login.dto';

/** Explicitly provisioned synthetic Client only; disabled when the ID is unset. */
@Injectable()
export class ReviewLoginHandler {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly login: ClientLoginHandler,
  ) {}

  async execute(dto: ReviewLoginDto, ip: string) {
    const id = this.config.get<string>('MOBILE_REVIEW_CLIENT_ID');
    if (!id) throw new UnauthorizedException('Invalid credentials');
    const client = await this.prisma.client.findUnique({ where: { id } });
    const email = dto.email.trim().toLowerCase();
    // Refuse existing customer/staff identities even if configured by mistake.
    if (!client || !client.isActive || client.deletedAt || client.userId || client.phone ||
      client.email !== 'apple@review.sawaa.invalid' || email !== client.email) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Reuse hashed-password checks, Redis limits, lockouts and tokenVersion.
    const result = await this.login.execute({ email, password: dto.password }, ip);
    if (result.clientId !== id) throw new UnauthorizedException('Invalid credentials');
    return {
      sessionKind: 'client' as const,
      tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken },
    };
  }
}
