import { WhatsappInboundWorker } from './whatsapp-inbound.worker';

describe('WhatsappInboundWorker', () => {
  const data = {
    instance: 'sawaa-main',
    phone: '+966500000000',
    text: 'hello',
    externalMessageId: 'provider-message-1',
  };

  it('serializes processing per phone and releases the owned lock', async () => {
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
    };
    const orchestrator = { handleInbound: jest.fn().mockResolvedValue(undefined) };
    const worker = new WhatsappInboundWorker(
      { createWorker: jest.fn() } as never,
      { getClient: () => redis } as never,
      orchestrator as never,
    );

    await worker.execute(data);

    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^whatsapp:inbound:lock:[a-f0-9]{64}$/),
      expect.any(String),
      'PX',
      120_000,
      'NX',
    );
    expect(orchestrator.handleInbound).toHaveBeenCalledWith(
      data.phone,
      data.text,
      data.externalMessageId,
      undefined,
    );
    expect(redis.eval).toHaveBeenCalled();
  });

  it('fails retryably when another job owns the phone lock', async () => {
    const redis = { set: jest.fn().mockResolvedValue(null), eval: jest.fn() };
    const orchestrator = { handleInbound: jest.fn() };
    const worker = new WhatsappInboundWorker(
      { createWorker: jest.fn() } as never,
      { getClient: () => redis } as never,
      orchestrator as never,
    );

    await expect(worker.execute(data)).rejects.toThrow(/already being processed/);
    expect(orchestrator.handleInbound).not.toHaveBeenCalled();
  });
});
