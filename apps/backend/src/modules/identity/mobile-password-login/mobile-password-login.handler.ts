import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ClientLoginHandler } from '../client-auth/client-login.handler';
import { ClientLoginDto } from '../client-auth/client-login.dto';
import { normalizeIdentifier } from '../shared/identifier-detector';

export interface MobilePasswordLoginResult {
  sessionKind: 'client';
  tokens: { accessToken: string; refreshToken: string };
}

@Injectable()
export class MobilePasswordLoginHandler {
  constructor(private readonly prisma: PrismaService, private readonly login: ClientLoginHandler) {}

  async execute(dto: ClientLoginDto, ip = 'unknown'): Promise<MobilePasswordLoginResult> {
    if ((dto.email && dto.phone) || (!dto.email && !dto.phone)) {
      throw new BadRequestException('Provide exactly one of email or phone');
    }
    const channel = dto.email ? 'EMAIL' : 'SMS';
    const identifier = normalizeIdentifier((dto.email ?? dto.phone)!, channel);
    const contact = channel === 'EMAIL'
      ? { email: { equals: identifier, mode: 'insensitive' as const } }
      : { phone: identifier };
    const users = await this.prisma.user.findMany({ where: contact });
    if (users.length > 1) throw new UnauthorizedException('Invalid credentials');
    const matchedUser = users[0];
    const clients = await this.prisma.client.findMany({
      where: { OR: [contact, ...(matchedUser ? [{ userId: matchedUser.id }] : [])] },
    });
    if (clients.length !== 1) throw new UnauthorizedException('Invalid credentials');
    const client = clients[0];
    if (!client.isActive || client.deletedAt) throw new UnauthorizedException('Invalid credentials');

    const user = client.userId
      ? await this.prisma.user.findUnique({ where: { id: client.userId } })
      : null;
    if ((client.userId && !user) || (matchedUser && matchedUser.id !== user?.id)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user) {
      if (!user.isActive || user.role !== 'CLIENT' || user.isSuperAdmin ||
          (client.email && normalizeIdentifier(client.email, 'EMAIL') !== normalizeIdentifier(user.email, 'EMAIL')) ||
          (client.phone && user.phone && client.phone !== user.phone)) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const linked = await this.prisma.client.findMany({ where: { userId: user.id } });
      if (linked.length !== 1 || linked[0].id !== client.id) throw new UnauthorizedException('Invalid credentials');
    }
    const verified = channel === 'EMAIL'
      ? (client.email && normalizeIdentifier(client.email, 'EMAIL') === identifier && client.emailVerified) ||
        (user && normalizeIdentifier(user.email, 'EMAIL') === identifier && user.emailVerifiedAt)
      : (client.phone === identifier && client.phoneVerified) ||
        (user?.phone === identifier && user.phoneVerifiedAt);
    if (!verified) throw new UnauthorizedException('Invalid credentials');

    // A mobile registration can keep its verified email on User only. Use the
    // linked Client's existing contact for the shared password/lockout path.
    const loginDto: ClientLoginDto = channel === 'EMAIL' && client.email
      ? { email: client.email, password: dto.password }
      : { phone: client.phone ?? undefined, password: dto.password };
    if (!loginDto.email && !loginDto.phone) throw new UnauthorizedException('Invalid credentials');
    try {
      const result = await this.login.execute(loginDto, ip, client.id);
      return { sessionKind: 'client', tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken } };
    } catch (error) {
      // Rate-limit and account failures have the same public response.
      if (error instanceof UnauthorizedException) throw new UnauthorizedException('Invalid credentials');
      throw error;
    }
  }
}
