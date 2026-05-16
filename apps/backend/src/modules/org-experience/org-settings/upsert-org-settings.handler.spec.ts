import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { TENANT_CLS_KEY } from '../../../common/constants';
import { UpsertOrgSettingsHandler } from './upsert-org-settings.handler';

describe('UpsertOrgSettingsHandler', () => {
  let handler: UpsertOrgSettingsHandler;
  let prisma: any;
  let cls: any;

  beforeEach(async () => {
    prisma = {
      organizationSettings: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    };
    cls = { get: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UpsertOrgSettingsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: ClsService, useValue: cls },
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
});
