import { CanActivate, ExecutionContext, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderClientService } from '../../../infrastructure/ai/ai-provider-client.service';

export interface WebChatProcessingReadiness {
  configVersion: number;
  testedConfigHash: string;
}

/**
 * Keeps the public web-chat surface unavailable unless it is explicitly enabled.
 * A 404 avoids advertising a disabled guest/client capability while leaving
 * unrelated bootstrap endpoints (health and CSRF) untouched.
 */
@Injectable()
export class WebChatAvailabilityService {
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly providerClient?: AiProviderClientService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<boolean>('WEB_CHAT_ENABLED') === true;
  }

  /**
   * Public chat visibility and assistant processing are separate gates. A
   * visible widget must not cause a worker to acquire a lease until the
   * singleton provider has passed the tested-connection contract.
   */
  async getProcessingReadiness(): Promise<WebChatProcessingReadiness | null> {
    if (!this.isEnabled() || !this.providerClient) return null;
    try {
      const ready = await this.providerClient.getReadyClient();
      return ready
        ? { configVersion: ready.configVersion, testedConfigHash: ready.testedConfigHash }
        : null;
    } catch {
      return null;
    }
  }

  async isProcessingReady(expected?: WebChatProcessingReadiness): Promise<boolean> {
    const current = await this.getProcessingReadiness();
    return current !== null
      && (expected === undefined
        || (current.configVersion === expected.configVersion
          && current.testedConfigHash === expected.testedConfigHash));
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
