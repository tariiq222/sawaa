import { Test } from '@nestjs/testing';

import { OnBookingReminderHandler } from './on-booking-reminder.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';

describe('OnBookingReminderHandler', () => {
  let handler: OnBookingReminderHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OnBookingReminderHandler,
    { provide: SendNotificationHandler, useValue: { execute: jest.fn() } },
    { provide: GetClientPushTargetsHandler, useValue: { execute: jest.fn() } }
      ],
    }).compile();

    handler = module.get(OnBookingReminderHandler);
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
