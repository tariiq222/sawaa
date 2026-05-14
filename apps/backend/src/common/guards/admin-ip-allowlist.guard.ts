import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';

@Injectable()
export class AdminIpAllowlistGuard implements CanActivate {
  constructor(private readonly settings: PlatformSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedIps = await this.settings.get<string[]>('security.ipAllowlist');

    // Empty or null list = no restriction
    if (!allowedIps || allowedIps.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const clientIp =
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.ip ?? '');

    if (!allowedIps.includes(clientIp)) {
      throw new ForbiddenException(`IP ${clientIp} is not in the admin allowlist`);
    }

    return true;
  }
}
