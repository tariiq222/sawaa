import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminHostGuard implements CanActivate {
  private readonly allowedHosts: string[];

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('ADMIN_HOSTS', 'admin.deqah.app');
    this.allowedHosts = raw.split(',').map((host) => host.trim().toLowerCase());
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const host = String(req.headers.host ?? '').toLowerCase();

    if (!this.allowedHosts.includes(host)) {
      throw new ForbiddenException('admin_host_required');
    }

    return true;
  }
}
