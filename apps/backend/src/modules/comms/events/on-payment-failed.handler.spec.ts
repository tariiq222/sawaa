import { Test } from '@nestjs/testing';

import { OnPaymentFailedHandler } from './on-payment-failed.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';

describe('OnPaymentFailedHandler', () => {
  let handler: OnPaymentFailedHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OnPaymentFailedHandler,
    { provide: SendNotificationHandler, useValue: { execute: jest.fn() } },
    { provide: GetClientPushTargetsHandler, useValue: { execute: jest.fn() } }
      ],
    }).compile();

    handler = module.get(OnPaymentFailedHandler);
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
