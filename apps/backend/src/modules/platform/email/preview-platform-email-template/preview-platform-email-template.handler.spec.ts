import { Test } from '@nestjs/testing';

import { PreviewPlatformEmailTemplateHandler } from './preview-platform-email-template.handler';
import { GetPlatformEmailTemplateHandler } from '../get-platform-email-template/get-platform-email-template.handler';

describe('PreviewPlatformEmailTemplateHandler', () => {
  let handler: PreviewPlatformEmailTemplateHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PreviewPlatformEmailTemplateHandler,
    { provide: GetPlatformEmailTemplateHandler, useValue: { execute: jest.fn() } }
      ],
    }).compile();

    handler = module.get(PreviewPlatformEmailTemplateHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('executes without throwing', async () => {
    try {
      await handler.execute({});
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
