// Single-tenant SMS provider resolver.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SINGLE_TENANT_CONTEXT_ID } from '../../common/constants';
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

  async resolve(): Promise<SmsProvider> {
    const cfg = await this.prisma.organizationSmsConfig.findFirst();
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
          SINGLE_TENANT_CONTEXT_ID,
        );
        return new UnifonicAdapter(creds);
      }
      case 'TAQNYAT': {
        const creds = this.credentials.decrypt<TaqnyatCredentials>(
          cfg.credentialsCiphertext,
          SINGLE_TENANT_CONTEXT_ID,
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
