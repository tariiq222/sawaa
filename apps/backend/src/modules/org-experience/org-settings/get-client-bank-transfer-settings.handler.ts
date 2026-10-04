import { Injectable } from '@nestjs/common';
import type { ClientBankTransferSettings } from '@sawaa/shared';
import { PrismaService } from '../../../infrastructure/database';
import { getValidBankTransferAccounts, isClientBankTransferEnabled } from './bank-transfer-settings';

@Injectable()
export class GetClientBankTransferSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<ClientBankTransferSettings> {
    const settings = await this.prisma.organizationSettings.findFirst({
      select: { paymentBankTransferEnabled: true, bankTransferAccounts: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!isClientBankTransferEnabled(settings)) return { enabled: false, accounts: [] };
    return {
      enabled: true,
      accounts: getValidBankTransferAccounts(settings?.bankTransferAccounts),
    };
  }
}
