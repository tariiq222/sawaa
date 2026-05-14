import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { MailModule } from '../../../infrastructure/mail';
import { ListPlatformEmailTemplatesHandler } from './list-platform-email-templates/list-platform-email-templates.handler';
import { GetPlatformEmailTemplateHandler } from './get-platform-email-template/get-platform-email-template.handler';
import { UpdatePlatformEmailTemplateHandler } from './update-platform-email-template/update-platform-email-template.handler';
import { PreviewPlatformEmailTemplateHandler } from './preview-platform-email-template/preview-platform-email-template.handler';
import { SendTestEmailHandler } from './send-test-email/send-test-email.handler';
import { ListPlatformEmailLogsHandler } from './list-platform-email-logs/list-platform-email-logs.handler';

const HANDLERS = [
  ListPlatformEmailTemplatesHandler,
  GetPlatformEmailTemplateHandler,
  UpdatePlatformEmailTemplateHandler,
  PreviewPlatformEmailTemplateHandler,
  SendTestEmailHandler,
  ListPlatformEmailLogsHandler,
];

@Module({
  imports: [DatabaseModule, MailModule],
  providers: [...HANDLERS],
  exports: [...HANDLERS],
})
export class PlatformEmailModule {}
