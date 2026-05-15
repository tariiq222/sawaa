import { Test } from '@nestjs/testing';
import { EventBusService } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { OnClientEnrolledHandler } from './on-client-enrolled.handler';

describe('OnClientEnrolledHandler', () => {
  let handler: OnClientEnrolledHandler;
  let notify: any;
  let eventBus: any;

  beforeEach(async () => {
    notify = { execute: jest.fn() };
    eventBus = { subscribe: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        OnClientEnrolledHandler,
        { provide: SendNotificationHandler, useValue: notify },
      ],
    }).compile();

    handler = module.get(OnClientEnrolledHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should subscribe on register', () => {
    handler.register(eventBus as any);
    expect(eventBus.subscribe).toHaveBeenCalledWith('people.client.enrolled', expect.any(Function));
  });

  it('should send welcome notification on handle', async () => {
    await handler.handle({ payload: { clientId: 'c1', name: 'John', email: 'a@b.com' } } as any);
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: 'c1',
      type: 'WELCOME',
      title: 'مرحباً بك!',
      recipientEmail: 'a@b.com',
    }));
  });

  it('should handle without email', async () => {
    await handler.handle({ payload: { clientId: 'c2', name: 'Jane' } } as any);
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: undefined,
    }));
  });

  it('should swallow notification errors', async () => {
    notify.execute.mockRejectedValue(new Error('fail'));
    await expect(handler.handle({ payload: { clientId: 'c1', name: 'John' } } as any)).resolves.not.toThrow();
  });
});
