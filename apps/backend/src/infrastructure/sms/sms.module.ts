// SaaS-02g-sms — SMS infrastructure module.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { SmsCredentialsService } from './sms-credentials.service';
import { SmsProviderFactory } from './sms-provider.factory';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [SmsCredentialsService, SmsProviderFactory],
  exports: [SmsCredentialsService, SmsProviderFactory],
})
export class SmsModule {}
