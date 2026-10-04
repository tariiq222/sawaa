import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../../infrastructure/database';
import { PAYMENT_CONFIG_SINGLETON_KEY } from '../../../../../common/constants';
import { GetPublicPaymentMethodsHandler } from './get-public-payment-methods.handler';

describe('GetPublicPaymentMethodsHandler', () => {
  let handler: GetPublicPaymentMethodsHandler;
  let prisma: PrismaService;
  let findSettings: jest.Mock;
  let findConfig: jest.Mock;
  let findClientSettings: jest.Mock;

  beforeEach(async () => {
    findSettings = jest.fn();
    findConfig = jest.fn();
    findClientSettings = jest.fn().mockResolvedValue({ payAtClinicEnabled: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPublicPaymentMethodsHandler,
        {
          provide: PrismaService,
          useValue: {
            organizationSettings: { findFirst: findSettings },
            organizationPaymentConfig: { findUnique: findConfig },
            bookingSettings: { findFirst: findClientSettings },
          },
        },
      ],
    }).compile();

    handler = module.get(GetPublicPaymentMethodsHandler);
    prisma = module.get(PrismaService);
  });

  const withSettings = (settings: unknown) => findSettings.mockResolvedValue(settings);
  const withConfig = (config: unknown) => findConfig.mockResolvedValue(config);
  const withClientSettings = (clientSettings: unknown) =>
    findClientSettings.mockResolvedValue(clientSettings);

  it('advertises both methods when both are enabled and Moyasar is configured', async () => {
    withSettings({ paymentMoyasarEnabled: true, paymentAtClinicEnabled: true });
    withConfig({ id: 'cfg-1' });

    await expect(handler.execute()).resolves.toEqual({
      moyasarEnabled: true,
      atClinicEnabled: true,
    });
  });

  it('hides online payment when the admin disabled Moyasar', async () => {
    withSettings({ paymentMoyasarEnabled: false, paymentAtClinicEnabled: true });
    withConfig({ id: 'cfg-1' });

    await expect(handler.execute()).resolves.toEqual({
      moyasarEnabled: false,
      atClinicEnabled: true,
    });
  });

  it('hides online payment when Moyasar is enabled but no credentials are configured', async () => {
    withSettings({ paymentMoyasarEnabled: true, paymentAtClinicEnabled: true });
    withConfig(null);

    await expect(handler.execute()).resolves.toEqual({
      moyasarEnabled: false,
      atClinicEnabled: true,
    });
  });

  it('hides pay-at-center when the admin disabled it', async () => {
    withSettings({ paymentMoyasarEnabled: true, paymentAtClinicEnabled: false });
    withConfig({ id: 'cfg-1' });

    await expect(handler.execute()).resolves.toEqual({
      moyasarEnabled: true,
      atClinicEnabled: false,
    });
  });

  it('offers nothing payable and no center collection when no settings row exists', async () => {
    withSettings(null);
    withConfig(null);

    await expect(handler.execute()).resolves.toEqual({
      moyasarEnabled: false,
      atClinicEnabled: false,
    });
  });

  it('hides pay-at-center from clients when the client-only switch is off, without touching reception', async () => {
    withSettings({ paymentMoyasarEnabled: true, paymentAtClinicEnabled: true });
    withConfig({ id: 'cfg-1' });
    withClientSettings({ payAtClinicEnabled: false });

    await expect(handler.execute()).resolves.toEqual({
      moyasarEnabled: true,
      atClinicEnabled: false,
    });
  });

  it('keeps pay-at-center for clients when the client-only switch is on', async () => {
    withSettings({ paymentMoyasarEnabled: true, paymentAtClinicEnabled: true });
    withConfig({ id: 'cfg-1' });
    withClientSettings({ payAtClinicEnabled: true });

    await expect(handler.execute()).resolves.toEqual({
      moyasarEnabled: true,
      atClinicEnabled: true,
    });
  });

  it('requires explicit client opt-in when no client-settings row exists', async () => {
    withSettings({ paymentMoyasarEnabled: true, paymentAtClinicEnabled: true });
    withConfig({ id: 'cfg-1' });
    withClientSettings(null);

    await expect(handler.execute()).resolves.toEqual({
      moyasarEnabled: true,
      atClinicEnabled: false,
    });
  });

  it('reads the newest settings row and the singleton config key', async () => {
    withSettings({ paymentMoyasarEnabled: true, paymentAtClinicEnabled: true });
    withConfig({ id: 'cfg-1' });

    await handler.execute();

    expect(prisma.organizationSettings.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
    expect(prisma.organizationPaymentConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
      }),
    );
  });
});
