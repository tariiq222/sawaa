import { PrismaService } from '../../../infrastructure/database';
import { GetClientBankTransferSettingsHandler } from './get-client-bank-transfer-settings.handler';

describe('GetClientBankTransferSettingsHandler', () => {
  const configuredAccount = {
    id: 'bank-1',
    label: 'Main',
    bankName: 'Sawa Bank',
    beneficiaryName: 'Sawa Center',
    iban: 'SA03 8000 0000 6080 1016 7519',
  };

  it('returns normalized accounts only when the client method is enabled', async () => {
    const prisma = {
      organizationSettings: {
        findFirst: jest.fn().mockResolvedValue({
          paymentBankTransferEnabled: true,
          bankTransferAccounts: [configuredAccount],
        }),
      },
    };
    const handler = new GetClientBankTransferSettingsHandler(prisma as unknown as PrismaService);

    await expect(handler.execute()).resolves.toEqual({
      enabled: true,
      accounts: [{ ...configuredAccount, iban: 'SA0380000000608010167519' }],
    });
  });

  it('does not expose account details when client bank transfer is disabled', async () => {
    const prisma = {
      organizationSettings: {
        findFirst: jest.fn().mockResolvedValue({
          paymentBankTransferEnabled: false,
          bankTransferAccounts: [configuredAccount],
        }),
      },
    };
    const handler = new GetClientBankTransferSettingsHandler(prisma as unknown as PrismaService);

    await expect(handler.execute()).resolves.toEqual({ enabled: false, accounts: [] });
  });
});
