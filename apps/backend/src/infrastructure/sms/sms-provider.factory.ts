// SaaS-02g-sms — resolves the SmsProvider adapter for the current tenant.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NoOpAdapter } from './no-op.adapter';
import { SmsCredentialsService } from './sms-credentials.service';
import type { SmsProvider } from './sms-provider.interface';
import {
  TaqnyatAdapter,
  type TaqnyatCredentials,
} from './taqnyat.adapter';
import {
  UnifonicAdapter,
  type UnifonicCredentials,
} from './unifonic.adapter';

@Injectable()
export class SmsProviderFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: SmsCredentialsService,
  ) {}

  async forCurrentTenant(organizationId: string): Promise<SmsProvider> {
    const cfg = await this.prisma.organizationSmsConfig.findFirst({
      where: { organizationId },
    });
    if (
      !cfg ||
      cfg.provider === 'NONE' ||
      !cfg.credentialsCiphertext
    ) {
      return new NoOpAdapter();
    }
    switch (cfg.provider) {
      case 'UNIFONIC': {
        const creds = this.credentials.decrypt<UnifonicCredentials>(
          cfg.credentialsCiphertext,
          organizationId,
        );
        return new UnifonicAdapter(creds);
      }
      case 'TAQNYAT': {
        const creds = this.credentials.decrypt<TaqnyatCredentials>(
          cfg.credentialsCiphertext,
          organizationId,
        );
        return new TaqnyatAdapter(creds);
      }
      default:
        return new NoOpAdapter();
    }
  }

  /** Build a transient adapter from pending creds (for `/settings/sms/test` flow). */
  buildTransient(
    provider: 'UNIFONIC' | 'TAQNYAT',
    credentials: Record<string, unknown>,
  ): SmsProvider {
    if (provider === 'UNIFONIC') {
      return new UnifonicAdapter(credentials as UnifonicCredentials);
    }
    return new TaqnyatAdapter(credentials as TaqnyatCredentials);
  }
}
