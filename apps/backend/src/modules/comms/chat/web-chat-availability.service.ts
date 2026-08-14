import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Keeps the public web-chat surface unavailable unless it is explicitly enabled.
 * A 404 avoids advertising a disabled guest/client capability while leaving
 * unrelated bootstrap endpoints (health and CSRF) untouched.
 */
@Injectable()
export class WebChatAvailabilityService {
  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<boolean>('WEB_CHAT_ENABLED') === true;
  }

  assertEnabled(): void {
    if (!this.isEnabled()) throw new NotFoundException('Web chat is not available');
  }
}

@Injectable()
export class WebChatEnabledGuard implements CanActivate {
  constructor(private readonly availability: WebChatAvailabilityService) {}

  canActivate(_context: ExecutionContext): boolean {
    this.availability.assertEnabled();
    return true;
  }
}
