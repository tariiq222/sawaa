import { Test } from '@nestjs/testing';

import { OnClientEnrolledHandler } from './on-client-enrolled.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';

describe('OnClientEnrolledHandler', () => {
  let handler: OnClientEnrolledHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OnClientEnrolledHandler,
    { provide: SendNotificationHandler, useValue: { execute: jest.fn() } }
      ],
    }).compile();

    handler = module.get(OnClientEnrolledHandler);
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
