import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class InternalBearerGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const provided = Buffer.from(authHeader.slice(7));
    const expected = Buffer.from(
      this.configService.getOrThrow<string>('INTERNAL_METRICS_TOKEN'),
    );

    if (provided.length !== expected.length) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }
}