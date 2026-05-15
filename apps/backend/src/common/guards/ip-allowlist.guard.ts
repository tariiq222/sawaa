import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class IpAllowlistGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // Use req.ip which respects the 'trust proxy' setting in main.ts.
    // Do NOT trust X-Forwarded-For headers directly — they are spoofable
    // if the proxy chain is not validated.
    const clientIp = req.ip ?? '';

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