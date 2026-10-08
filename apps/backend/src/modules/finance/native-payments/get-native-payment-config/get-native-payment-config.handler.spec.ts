import { GetNativePaymentConfigHandler } from './get-native-payment-config.handler';

describe('native capabilities', () => {
  const setup = (
    row: any = { publishableKey: 'pk_test_valid', isLive: false },
    enabled = true,
    env: Record<string, string> = {},
  ) => {
    const prisma = {
      organizationPaymentConfig: {
        findUnique: jest.fn().mockResolvedValue(row),
      },
      organizationSettings: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ paymentMoyasarEnabled: enabled }),
      },
    };
    return new GetNativePaymentConfigHandler(
      prisma as any,
      { get: (key: string) => env[key] } as any,
    );
  };
  it.each([
    null,
    { publishableKey: '', isLive: false },
    { publishableKey: 'pk_live_valid', isLive: false },
    { publishableKey: 'pk_test_valid', isLive: true },
  ])('fails closed for invalid config %p', async (row) => {
    expect((await setup(row).execute()).enabled).toBe(false);
  });
  it('fails closed when disabled', async () =>
    expect((await setup(undefined, false).execute()).enabled).toBe(false));
  it('only returns safe capabilities', async () => {
    const result = await setup().execute();
    expect(result).toEqual({
      enabled: true,
      isLive: false,
      supportedNetworks: ['mada', 'visa', 'mastercard'],
      applePay: null,
    });
  });
  it('requires all Apple settings', async () => {
    expect(
      (
        await setup(undefined, true, {
          MOYASAR_APPLE_PAY_ENABLED: 'true',
        }).execute()
      ).applePay,
    ).toBeNull();
    expect(
      (
        await setup(undefined, true, {
          MOYASAR_APPLE_PAY_ENABLED: 'true',
          MOYASAR_APPLE_PAY_MERCHANT_ID: 'merchant.sa.sawaa',
          MOYASAR_APPLE_PAY_MERCHANT_LABEL: 'Sawaa',
        }).execute()
      ).applePay,
    ).toEqual({
      merchantId: 'merchant.sa.sawaa',
      label: 'Sawaa',
      countryCode: 'SA',
    });
  });
  it('does not expose stored ciphertext in initialization', async () => {
    const result = await setup({
      publishableKey: 'pk_test_valid',
      isLive: false,
      secretKeyEnc: 'secret',
      webhookSecretEnc: 'secret',
    }).getPaymentConfiguration();
    expect(Object.keys(result).sort()).toEqual(
      [
        'enabled',
        'isLive',
        'supportedNetworks',
        'applePay',
        'publishableKey',
      ].sort(),
    );
  });
});

describe('native capabilities settings row', () => {
  it('reads the newest organization settings row', async () => {
    const findFirst = jest.fn().mockResolvedValue({ paymentMoyasarEnabled: true });
    const handler = new GetNativePaymentConfigHandler(
      {
        organizationPaymentConfig: {
          findUnique: jest.fn().mockResolvedValue({ publishableKey: 'pk_test_valid', isLive: false }),
        },
        organizationSettings: { findFirst },
      } as any,
      { get: () => undefined } as any,
    );
    await handler.execute();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});
