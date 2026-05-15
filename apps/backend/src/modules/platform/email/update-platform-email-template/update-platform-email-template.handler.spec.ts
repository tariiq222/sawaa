import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { GetPlatformEmailTemplateHandler } from '../get-platform-email-template/get-platform-email-template.handler';
import { UpdatePlatformEmailTemplateHandler } from './update-platform-email-template.handler';

describe('UpdatePlatformEmailTemplateHandler', () => {
  let handler: UpdatePlatformEmailTemplateHandler;
  let getHandler: any;
  let prisma: any;

  beforeEach(async () => {
    getHandler = { execute: jest.fn() };
    prisma = { platformEmailTemplate: { update: jest.fn() } };

    const module = await Test.createTestingModule({
      providers: [
        UpdatePlatformEmailTemplateHandler,
        { provide: GetPlatformEmailTemplateHandler, useValue: getHandler },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(UpdatePlatformEmailTemplateHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when locked template has field change', async () => {
    getHandler.execute.mockResolvedValue({ isLocked: true });
    await expect(handler.execute({ slug: 'x', dto: { name: 'new' }, superAdminUserId: 'u1', ipAddress: '', userAgent: '' }))
      .rejects.toThrow(ForbiddenException);
  });

  it('should allow isActive change on locked template', async () => {
    getHandler.execute.mockResolvedValue({ isLocked: true });
    prisma.platformEmailTemplate.update.mockResolvedValue({ id: 1 });
    const result = await handler.execute({ slug: 'x', dto: { isActive: false }, superAdminUserId: 'u1', ipAddress: '', userAgent: '' });
    expect(prisma.platformEmailTemplate.update).toHaveBeenCalledWith({
      where: { slug: 'x' },
      data: { version: { increment: 1 }, updatedById: 'u1', isActive: false },
    });
  });

  it('should update all fields on unlocked template', async () => {
    getHandler.execute.mockResolvedValue({ isLocked: false });
    prisma.platformEmailTemplate.update.mockResolvedValue({ id: 2 });
    const result = await handler.execute({
      slug: 'welcome',
      dto: { name: 'Welcome', subjectAr: 'مرحبا', subjectEn: 'Welcome', htmlBody: '<p>hi</p>', isActive: true },
      superAdminUserId: 'u1',
      ipAddress: '',
      userAgent: '',
    });
    expect(prisma.platformEmailTemplate.update).toHaveBeenCalledWith({
      where: { slug: 'welcome' },
      data: {
        version: { increment: 1 },
        updatedById: 'u1',
        name: 'Welcome',
        subjectAr: 'مرحبا',
        subjectEn: 'Welcome',
        htmlBody: '<p>hi</p>',
        isActive: true,
      },
    });
  });

  it('should update only provided fields', async () => {
    getHandler.execute.mockResolvedValue({ isLocked: false });
    prisma.platformEmailTemplate.update.mockResolvedValue({ id: 3 });
    await handler.execute({ slug: 'x', dto: { name: 'OnlyName' }, superAdminUserId: 'u1', ipAddress: '', userAgent: '' });
    const data = prisma.platformEmailTemplate.update.mock.calls[0][0].data;
    expect(data.name).toBe('OnlyName');
    expect(data.subjectAr).toBeUndefined();
  });
});
