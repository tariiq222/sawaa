import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../infrastructure/database';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../common/constants';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { loadSystemRolePermissions } from './shared/load-system-role-permissions';
import type { JwtPayload } from './shared/token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly casl: CaslAbilityFactory,
    private readonly cls: ClsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    this.logger.debug(`systemContext bypass for JWT bootstrap (sub=${payload.sub})`);

    // All DB queries must run inside the CLS context block for RLS bypass
    const { user, systemRolePermissions } = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);

      const foundUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { customRole: { include: { permissions: true } } },
      });

      // RX-PERMS-EMPTY: route through the shared loader so login / `me` /
      // dashboard-OTP and this strategy all agree on whether the DB row
      // grants permissions, fell back to BUILT_IN, or is an explicit deny-all.
      const sysRolePerms = foundUser
        ? await loadSystemRolePermissions(this.prisma, foundUser.role)
        : null;

      return { user: foundUser, systemRolePermissions: sysRolePerms };
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    // P0-1: admin/dashboard JwtStrategy must never accept CLIENT-role tokens.
    if (user.role === 'CLIENT') {
      throw new UnauthorizedException('Client tokens cannot access this surface');
    }

    // P0-6: tokenVersion check
    if (typeof payload.tokenVersion === 'number' && user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session has been revoked');
    }

    const ability = this.casl.buildForUser({
      role: user.role,
      customRole: user.customRole,
      systemRolePermissions,
    });

    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      customRoleId: user.customRoleId,
      customRole: user.customRole,
      permissions: ability.rules.flatMap((r) => {
        const actions = Array.isArray(r.action) ? r.action : [r.action];
        return actions.map((a) => ({ action: String(a), subject: String(r.subject) }));
      }),
      features: payload.features ?? [],
      isSuperAdmin: user.isSuperAdmin === true,
      scope: payload.scope,
    };
  }
}
