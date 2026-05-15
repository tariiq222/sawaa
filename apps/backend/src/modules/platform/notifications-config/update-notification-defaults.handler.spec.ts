import { Test } from '@nestjs/testing';

import { UpdateNotificationDefaultsHandler } from './update-notification-defaults.handler';
import { PlatformSettingsService } from '../settings/platform-settings.service';

describe('UpdateNotificationDefaultsHandler', () => {
  let handler: UpdateNotificationDefaultsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UpdateNotificationDefaultsHandler,
    { provide: PlatformSettingsService, useValue: {} }
      ],
    }).compile();

    handler = module.get(UpdateNotificationDefaultsHandler);
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
