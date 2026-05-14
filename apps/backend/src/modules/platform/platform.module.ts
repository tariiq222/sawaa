import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../infrastructure/mail';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { DashboardPlatformController } from '../../api/dashboard/platform.controller';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { PasswordService } from '../identity/shared/password.service';
import { CreateProblemReportHandler } from './problem-reports/create-problem-report.handler';
import { ListProblemReportsHandler } from './problem-reports/list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from './problem-reports/update-problem-report-status.handler';
import { UpsertIntegrationHandler } from './integrations/upsert-integration.handler';
import { ListIntegrationsHandler } from './integrations/list-integrations.handler';
import { FinanceModule } from '../finance/finance.module';
import { IdentityModule } from '../identity/identity.module';
import { PlatformSettingsModule } from './settings/platform-settings.module';
import { PlatformEmailModule } from './email/platform-email.module';
import { NotificationsConfigModule } from './notifications-config/notifications-config.module';
import { SystemHealthModule } from './system-health/system-health.module';

@Module({
  imports: [
    DatabaseModule,
   
    FinanceModule,
    IdentityModule,
   
    PlatformSettingsModule,
    PlatformEmailModule,
    NotificationsConfigModule,
    SystemHealthModule,
    MailModule,
    MessagingModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],

  controllers: [
    DashboardPlatformController,
  ],
  providers: [
    RedisService,
    PasswordService,
    CreateProblemReportHandler,
    ListProblemReportsHandler,
    UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler,
    ListIntegrationsHandler,
  ],
  exports: [
    PlatformSettingsModule,
    CreateProblemReportHandler,
    ListProblemReportsHandler,
    UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler,
    ListIntegrationsHandler,
  ],
})
export class PlatformModule {}
