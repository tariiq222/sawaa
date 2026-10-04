import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { TENANT_CLS_KEY } from '../../../common/constants';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';
import { getValidBankTransferAccounts, isClientBankTransferEnabled } from './bank-transfer-settings';

@Injectable()
export class UpsertOrgSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: UpsertOrgSettingsDto) {
    if (dto.vatRate !== undefined) {
      const tenantCtx = this.cls.get<{ isSuperAdmin?: boolean }>(TENANT_CLS_KEY);
      if (!tenantCtx?.isSuperAdmin) {
        throw new ForbiddenException('Only super-admin can edit VAT rate');
      }
    }

    const existing = await this.prisma.organizationSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const effectiveBankTransferSettings = {
      paymentBankTransferEnabled: dto.paymentBankTransferEnabled ?? existing?.paymentBankTransferEnabled ?? false,
      bankTransferAccounts: dto.bankTransferAccounts ?? existing?.bankTransferAccounts,
    };
    if (
      effectiveBankTransferSettings.paymentBankTransferEnabled &&
      !isClientBankTransferEnabled(effectiveBankTransferSettings)
    ) {
      throw new BadRequestException('Configure at least one valid Saudi bank account before enabling client bank transfer');
    }

    const { bankTransferAccounts, ...settingsDto } = dto;
    const data = {
      ...settingsDto,
      ...(bankTransferAccounts !== undefined ? {
        bankTransferAccounts: getValidBankTransferAccounts(bankTransferAccounts) as unknown as Prisma.InputJsonValue,
      } : {}),
    };
    if (
      bankTransferAccounts &&
      getValidBankTransferAccounts(bankTransferAccounts).length !== bankTransferAccounts.length
    ) {
      throw new BadRequestException('Every bank transfer account must include a valid Saudi IBAN and account details');
    }
    const saved = existing
      ? await this.prisma.organizationSettings.update({ where: { id: existing.id }, data })
      : await this.prisma.organizationSettings.create({ data });
    // The cached public service catalog carries vatRate; refresh it on change.
    if (dto.vatRate !== undefined) await this.cache.invalidatePrefix('ref:public-catalog');
    return saved;
  }
}
