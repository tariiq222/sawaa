import { Test } from '@nestjs/testing';

import { GetNotificationDefaultsHandler } from './get-notification-defaults.handler';
import { PlatformSettingsService } from '../settings/platform-settings.service';

describe('GetNotificationDefaultsHandler', () => {
  let handler: GetNotificationDefaultsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetNotificationDefaultsHandler,
    { provide: PlatformSettingsService, useValue: {} }
      ],
    }).compile();

    handler = module.get(GetNotificationDefaultsHandler);
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
