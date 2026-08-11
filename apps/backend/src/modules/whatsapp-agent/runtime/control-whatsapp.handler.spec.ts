import { ControlWhatsappHandler } from './control-whatsapp.handler';

describe('ControlWhatsappHandler', () => {
  function buildHandler(action: 'start' | 'stop' | 'restart') {
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      whatsappAgentConfig: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cfg-1',
          isActive: true,
          isConnected: true,
        }),
        update,
      },
    };
    const restart = jest.fn().mockResolvedValue({ ok: true });
    const resolve = jest.fn().mockResolvedValue({ client: { restart } });
    const handler = new ControlWhatsappHandler(prisma as never, { resolve } as never);
    return { handler, update, resolve, restart, action };
  }

  it('pauses the agent without logging the WhatsApp number out', async () => {
    const { handler, update, resolve } = buildHandler('stop');

    await expect(handler.execute({ action: 'stop' })).resolves.toEqual({
      action: 'stop',
      isActive: false,
    });
    expect(resolve).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { isActive: false },
    });
  });

  it('restarts the Evolution connection explicitly', async () => {
    const { handler, restart, resolve } = buildHandler('restart');

    await expect(handler.execute({ action: 'restart' })).resolves.toEqual({
      action: 'restart',
      isActive: true,
    });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);
  });
});
