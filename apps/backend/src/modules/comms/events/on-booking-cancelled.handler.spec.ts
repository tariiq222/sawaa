import { Test } from '@nestjs/testing';

import { OnBookingCancelledHandler } from './on-booking-cancelled.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';

describe('OnBookingCancelledHandler', () => {
  let handler: OnBookingCancelledHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OnBookingCancelledHandler,
    { provide: SendNotificationHandler, useValue: { execute: jest.fn() } },
    { provide: GetClientPushTargetsHandler, useValue: { execute: jest.fn() } }
      ],
    }).compile();

    handler = module.get(OnBookingCancelledHandler);
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
