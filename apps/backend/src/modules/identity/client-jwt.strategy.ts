import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../infrastructure/database';
import { TenantContextService } from '../../common/tenant';

export interface ClientJwtPayload {
  sub: string;
  email: string;
  namespace: 'client';
  jti: string;
  organizationId?: string;
}

@Injectable()
export class ClientJwtStrategy extends PassportStrategy(Strategy, 'client-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          if (req?.cookies?.client_access_token) {
            return req.cookies.client_access_token;
          }
          return null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_CLIENT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: ClientJwtPayload) {
    if (payload.namespace !== 'client') {
      throw new UnauthorizedException('Invalid token namespace');
    }
    if (!payload.organizationId) {
      throw new UnauthorizedException('Client token missing tenant claim');
    }

    const client = await this.prisma.client.findUnique({
      where: { id: payload.sub },
    });

    if (!client || !client.isActive || client.deletedAt) {
      throw new UnauthorizedException('Client not found or inactive');
    }

    if (client.organizationId !== payload.organizationId) {
      throw new UnauthorizedException('Client organization mismatch');
    }

    // Set tenant context ONLY after all DB validations pass (P1-5)
    this.tenantContext.set({
      organizationId: payload.organizationId,
      id: payload.sub,
      role: 'CLIENT',
      isSuperAdmin: false,
    });

    return {
      id: client.id,
      email: client.email,
      phone: client.phone,
      organizationId: payload.organizationId,
    };
  }
}
