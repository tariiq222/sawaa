import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../tenant/tenant.constants';

interface SuperAdminRequestUser {
  scope?: string;
}

@Injectable()
export class SuperAdminContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SuperAdminContextInterceptor.name);

  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: SuperAdminRequestUser }>();

    if (req.user?.scope === 'impersonation') {
      throw new ForbiddenException('admin_route_forbidden_under_impersonation');
    }

    this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
    this.logger.log('systemContext: super-admin interceptor');
    return next.handle();
  }
}
