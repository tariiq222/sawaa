import { GetWhatsappQrHandler } from './get-whatsapp-qr.handler';

describe('GetWhatsappQrHandler', () => {
  it('provisions a missing Evolution instance before fetching its QR', async () => {
    const getConnectionState = jest
      .fn()
      .mockRejectedValue(new Error('Evolution API 404: not found'));
    const getQr = jest
      .fn()
      .mockRejectedValueOnce(new Error('Evolution API 404: not found'))
      .mockResolvedValueOnce({
        base64: 'data:image/png;base64,qr',
        pairingCode: '123456',
        count: 1,
      });
    const createInstance = jest.fn().mockResolvedValue({ created: true });
    const handler = new GetWhatsappQrHandler(
      {
        whatsappAgentConfig: {
          findFirst: jest.fn().mockResolvedValue({ id: 'cfg-1' }),
        },
      } as never,
      {
        resolve: jest.fn().mockResolvedValue({
          client: { getConnectionState, getQr, createInstance },
        }),
      } as never,
    );

    await expect(handler.execute()).resolves.toEqual({
      status: 'pending',
      base64: 'data:image/png;base64,qr',
      pairingCode: '123456',
      count: 1,
      connectedPhone: null,
      error: null,
    });
    expect(createInstance).toHaveBeenCalledTimes(1);
  });

  it('returns not_configured when there is no local agent row', async () => {
    const handler = new GetWhatsappQrHandler(
      {
        whatsappAgentConfig: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      } as never,
      {} as never,
    );

    await expect(handler.execute()).resolves.toMatchObject({
      status: 'not_configured',
    });
  });
});
