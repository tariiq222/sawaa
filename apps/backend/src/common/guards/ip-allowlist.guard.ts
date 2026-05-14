import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class IpAllowlistGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const clientIp = (req.headers['x-real-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.ip ?? '');

    const allowedIps = this.config
      .getOrThrow<string>('INTERNAL_METRICS_ALLOWED_IPS')
      .split(',')
      .map(ip => ip.trim());

    if (!allowedIps.includes(clientIp)) {
      throw new ForbiddenException(`IP ${clientIp} is not allowed`);
    }

    return true;
  }
}