import { SINGLE_TENANT_CONTEXT_ID, TENANT_CLS_KEY } from '../constants';
import { ClsService } from 'nestjs-cls';
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

interface ClientSessionUser {
  id?: string;
  /** @deprecated Legacy claim. Accepted but ignored for internal context. */
  organizationId?: string | null;
  role?: string;
}

@Injectable()
export class ClientSessionGuard extends AuthGuard('client-jwt') {
  constructor(private readonly cls: ClsService) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    return super.canActivate(ctx);
  }

  handleRequest<TClient extends ClientSessionUser>(
    err: Error | null,
    client: TClient,
    _info: unknown,
    _ctx: ExecutionContext,
  ): TClient {
    if (err || !client || !client.id) {
      throw new UnauthorizedException('Invalid or expired client session');
    }
    const organizationId = SINGLE_TENANT_CONTEXT_ID;
    this.cls.set(TENANT_CLS_KEY, {
      organizationId,
      id: client.id,
      role: client.role ?? 'CLIENT',
      isSuperAdmin: false,
    });
    client.organizationId = organizationId;
    return client;
  }
}
