import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CacheService } from '../../../infrastructure/cache';
import { PrismaService } from '../../../infrastructure/database';
import { TENANT_CLS_KEY } from '../../../common/constants';
import { UpsertOrgSettingsHandler } from './upsert-org-settings.handler';

describe('UpsertOrgSettingsHandler', () => {
  let handler: UpsertOrgSettingsHandler;
  let prisma: any;
  let cls: any;
  let cache: any;

  beforeEach(async () => {
    prisma = {
      organizationSettings: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    };
    cls = { get: jest.fn() };
    cache = { invalidatePrefix: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        UpsertOrgSettingsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: ClsService, useValue: cls },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    handler = module.get(UpsertOrgSettingsHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when non-superAdmin tries to set vatRate', async () => {
    cls.get.mockReturnValue({ isSuperAdmin: false });
    await expect(handler.execute({ vatRate: 15 })).rejects.toThrow(ForbiddenException);
  });

  it('should throw when tenantCtx is null', async () => {
    cls.get.mockReturnValue(null);
    await expect(handler.execute({ vatRate: 15 })).rejects.toThrow(ForbiddenException);
  });

  it('should allow vatRate when superAdmin', async () => {
    cls.get.mockReturnValue({ isSuperAdmin: true });
    prisma.organizationSettings.findFirst.mockResolvedValue(null);
    prisma.organizationSettings.create.mockResolvedValue({ id: 's1' });

    const result = await handler.execute({ vatRate: 15 });
    expect(prisma.organizationSettings.create).toHaveBeenCalledWith({ data: { vatRate: 15 } });
  });

  it('should update existing settings', async () => {
    cls.get.mockReturnValue({ isSuperAdmin: false });
    prisma.organizationSettings.findFirst.mockResolvedValue({ id: 's1' });
    prisma.organizationSettings.update.mockResolvedValue({ id: 's1' });

    const result = await handler.execute({ timezone: 'UTC' });
    expect(prisma.organizationSettings.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { timezone: 'UTC' } });
  });

  it('should create settings when none exist', async () => {
    cls.get.mockReturnValue({ isSuperAdmin: false });
    prisma.organizationSettings.findFirst.mockResolvedValue(null);
    prisma.organizationSettings.create.mockResolvedValue({ id: 's2' });

    await handler.execute({ timezone: 'Asia/Riyadh' });
    expect(prisma.organizationSettings.create).toHaveBeenCalledWith({ data: { timezone: 'Asia/Riyadh' } });
  });

  it('rejects enabling client bank transfer without a valid account', async () => {
    prisma.organizationSettings.findFirst.mockResolvedValue({
      id: 's1',
      paymentBankTransferEnabled: false,
      bankTransferAccounts: [],
    });

    await expect(handler.execute({ paymentBankTransferEnabled: true })).rejects.toThrow(BadRequestException);
    expect(prisma.organizationSettings.update).not.toHaveBeenCalled();
  });

  it('allows enabling client bank transfer when at least one account is configured', async () => {
    prisma.organizationSettings.findFirst.mockResolvedValue({
      id: 's1',
      paymentBankTransferEnabled: false,
      bankTransferAccounts: [],
    });
    prisma.organizationSettings.update.mockResolvedValue({ id: 's1', paymentBankTransferEnabled: true });

    await handler.execute({
      paymentBankTransferEnabled: true,
      bankTransferAccounts: [{
        id: 'main-account',
        label: 'Main',
        bankName: 'Sawa Bank',
        beneficiaryName: 'Sawa Center',
        iban: 'SA0380000000608010167519',
      }],
    });

    expect(prisma.organizationSettings.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's1' },
      data: expect.objectContaining({ paymentBankTransferEnabled: true }),
    }));
  });

  it('refreshes the cached public catalog when the VAT rate changes', async () => {
    cls.get.mockReturnValue({ isSuperAdmin: true });
    prisma.organizationSettings.findFirst.mockResolvedValue({ id: 's1' });
    prisma.organizationSettings.update.mockResolvedValue({ id: 's1', vatRate: 0.15 });
    await handler.execute({ vatRate: 0.15 } as never);
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('ref:public-catalog');
  });

  it('leaves the catalog cache alone when VAT is not part of the update', async () => {
    cls.get.mockReturnValue({ isSuperAdmin: false });
    prisma.organizationSettings.findFirst.mockResolvedValue({ id: 's1' });
    prisma.organizationSettings.update.mockResolvedValue({ id: 's1' });
    await handler.execute({ contactEmail: 'a@b.sa' } as never);
    expect(cache.invalidatePrefix).not.toHaveBeenCalled();
  });
});
