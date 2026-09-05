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
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'people.client.enrolled', 'comms.client-enrolled-notify.v1', expect.any(Function),
    );
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

describe('OnClientEnrolledHandler v2 cutover', () => {
  it('materializes owned enrollment despite capture being paused', async () => {
    const notify = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue('intent-owned') };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(false) };
    const handler = new (OnClientEnrolledHandler as any)(notify, ownership, capture, materialize, config);

    await handler.handle({ eventId: 'event-enrolled-1', occurredAt: new Date(), payload: { clientId: 'client-1', name: 'سارة', email: 'sara@example.com' } });

    expect(materialize.execute).toHaveBeenCalledWith('intent-owned');
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('captures the client enrollment with the stable client source key after cutover', async () => {
    const notify = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn().mockResolvedValue('intent-new') };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnClientEnrolledHandler as any)(notify, ownership, capture, materialize, config);

    await handler.handle({ eventId: 'event-enrolled-2', version: 1, occurredAt: new Date(), payload: { clientId: 'client-2', name: 'نورة' } });

    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'client-enrolled:client-2', consumerKey: 'comms.client-enrolled-client.v2' }));
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('rejects an unsupported envelope version after ownership miss without legacy fallback', async () => {
    const notify = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn() };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnClientEnrolledHandler as any)(notify, ownership, capture, materialize, config);

    await expect(handler.handle({
      eventId: 'event-unsupported', version: 2, occurredAt: new Date(),
      payload: { clientId: 'client-1', name: 'سارة' },
    })).rejects.toThrow(/version/i);
    expect(config.shouldCapture).not.toHaveBeenCalled();
    expect(capture.execute).not.toHaveBeenCalled();
    expect(notify.execute).not.toHaveBeenCalled();
  });
});
