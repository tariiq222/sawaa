import { WhatsappInboundQueueService } from './whatsapp-inbound-queue.service';

describe('WhatsappInboundQueueService', () => {
  it('does not enqueue the same provider message twice', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-1' });
    const bull = { getQueue: jest.fn().mockReturnValue({ add }) };
    const redis = {
      set: jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn(),
    };
    const queue = new WhatsappInboundQueueService(
      bull as never,
      { getClient: () => redis } as never,
    );
    const event = {
      instance: 'sawaa-main',
      phone: '+966500000000',
      text: 'hello',
      externalMessageId: 'provider-message-1',
      rawBody: '{"event":"messages.upsert"}',
    };

    await queue.enqueue(event);
    await queue.enqueue(event);

    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][2].jobId).toMatch(/^[a-f0-9]{64}$/);
    expect(add.mock.calls[0][1]).not.toHaveProperty('rawBody');
  });

  it('drops messages above the per-phone burst limit before enqueueing', async () => {
    const add = jest.fn();
    const bull = { getQueue: jest.fn().mockReturnValue({ add }) };
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(31),
      expire: jest.fn(),
    };
    const queue = new WhatsappInboundQueueService(
      bull as never,
      { getClient: () => redis } as never,
    );

    await queue.enqueue({
      instance: 'sawaa-main',
      phone: '+966500000000',
      text: 'hello',
      externalMessageId: 'provider-message-31',
      rawBody: '{}',
    });

    expect(add).not.toHaveBeenCalled();
  });

  it('releases the replay marker when enqueueing fails', async () => {
    const add = jest.fn().mockRejectedValue(new Error('Redis queue unavailable'));
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn(),
      del: jest.fn(),
    };
    const queue = new WhatsappInboundQueueService(
      { getQueue: () => ({ add }) } as never,
      { getClient: () => redis } as never,
    );

    await expect(queue.enqueue({
      instance: 'sawaa-main',
      phone: '+966500000000',
      text: 'hello',
      externalMessageId: 'provider-message-failure',
      rawBody: '{}',
    })).rejects.toThrow('Redis queue unavailable');

    expect(redis.del).toHaveBeenCalledWith(
      expect.stringMatching(/^whatsapp:inbound:seen:[a-f0-9]{64}$/),
    );
  });

  it('caps inbound text before it reaches the queue and LLM', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-1' });
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn(),
    };
    const queue = new WhatsappInboundQueueService(
      { getQueue: () => ({ add }) } as never,
      { getClient: () => redis } as never,
    );

    await queue.enqueue({
      instance: 'sawaa-main',
      phone: '+966500000000',
      text: 'x'.repeat(10_000),
      externalMessageId: 'provider-message-long',
      rawBody: '{}',
    });

    expect(add.mock.calls[0][1].text).toHaveLength(4_000);
  });
});
