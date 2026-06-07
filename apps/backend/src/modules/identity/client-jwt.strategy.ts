import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SINGLE_TENANT_CONTEXT_ID, TENANT_CLS_KEY } from '../../common/constants';
import { PrismaService } from '../../infrastructure/database';

export interface ClientJwtPayload {
  sub: string;
  email: string;
  namespace: 'client';
  jti: string;
  /** @deprecated Legacy claim; accepted but ignored for internal context. */
  organizationId?: string;
  tokenVersion: number;
}

@Injectable()
export class ClientJwtStrategy extends PassportStrategy(Strategy, 'client-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
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
    const client = await this.prisma.client.findUnique({
      where: { id: payload.sub },
    });

    if (!client || !client.isActive || client.deletedAt) {
      throw new UnauthorizedException('Client not found or inactive');
    }

    if (client.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Set context ONLY after all DB validations pass (P1-5). Ignore the
    // legacy token organizationId so forged/stale values cannot select config.
    this.cls.set(TENANT_CLS_KEY, {
      organizationId: SINGLE_TENANT_CONTEXT_ID,
      id: payload.sub,
      role: 'CLIENT',
      isSuperAdmin: false,
    });

    return {
      id: client.id,
      email: client.email,
      phone: client.phone,
      organizationId: SINGLE_TENANT_CONTEXT_ID,
    };
  }
}
