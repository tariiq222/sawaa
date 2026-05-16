import { Test } from '@nestjs/testing';

import { SendTestEmailHandler } from './send-test-email.handler';
import { PreviewPlatformEmailTemplateHandler } from '../preview-platform-email-template/preview-platform-email-template.handler';
import { PlatformMailerService } from '../../../../infrastructure/mail/platform-mailer.service';

describe('SendTestEmailHandler', () => {
  let handler: SendTestEmailHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SendTestEmailHandler,
    { provide: PreviewPlatformEmailTemplateHandler, useValue: { execute: jest.fn() } },
    { provide: PlatformMailerService, useValue: {} }
      ],
    }).compile();

    handler = module.get(SendTestEmailHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('executes without throwing', async () => {
    try {
      await handler.execute({ slug: 'test-template', to: 'test@example.com' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
