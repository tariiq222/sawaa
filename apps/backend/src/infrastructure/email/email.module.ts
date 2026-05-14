// email-module — infrastructure module for per-tenant email providers.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { EmailCredentialsService } from './email-credentials.service';
import { EmailProviderFactory } from './email-provider.factory';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [EmailCredentialsService, EmailProviderFactory],
  exports: [EmailCredentialsService, EmailProviderFactory],
})
export class EmailModule {}
