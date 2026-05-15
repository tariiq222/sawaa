import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateEmailTemplateHandler } from './update-email-template.handler';
import { PrismaService } from '../../../infrastructure/database';

jest.mock('./render-blocks', () => ({
  renderBlocksToHtml: jest.fn().mockReturnValue('<html>rendered</html>'),
}));

describe('UpdateEmailTemplateHandler', () => {
  let handler: UpdateEmailTemplateHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      emailTemplate: { findFirst: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdateEmailTemplateHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<UpdateEmailTemplateHandler>(UpdateEmailTemplateHandler);
  });

  it('should throw NotFoundException when template not found', async () => {
    prisma.emailTemplate.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('should update name and subject only', async () => {
    prisma.emailTemplate.findFirst.mockResolvedValue({ id: 't1', name: 'Old' });
    prisma.emailTemplate.update.mockResolvedValue({ id: 't1', name: 'New', subject: 'Subject' });

    const result = await handler.execute({ id: 't1', name: 'New', subject: 'Subject' });
    expect(prisma.emailTemplate.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { name: 'New', subject: 'Subject' },
    });
    expect(result.name).toBe('New');
  });

  it('should update blocks and render htmlBody', async () => {
    prisma.emailTemplate.findFirst.mockResolvedValue({ id: 't1' });
    prisma.emailTemplate.update.mockResolvedValue({ id: 't1', htmlBody: '<html>rendered</html>' });

    await handler.execute({ id: 't1', blocks: [{ type: 'text', content: 'hello' }] as any });
    expect(prisma.emailTemplate.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({ htmlBody: '<html>rendered</html>', blocks: [{ type: 'text', content: 'hello' }] }),
    });
  });

  it('should update htmlBody and clear blocks when blocks not provided', async () => {
    prisma.emailTemplate.findFirst.mockResolvedValue({ id: 't1' });
    prisma.emailTemplate.update.mockResolvedValue({ id: 't1', htmlBody: '<p>raw</p>' });

    await handler.execute({ id: 't1', htmlBody: '<p>raw</p>' });
    expect(prisma.emailTemplate.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({ htmlBody: '<p>raw</p>', blocks: null }),
    });
  });

  it('should update isActive', async () => {
    prisma.emailTemplate.findFirst.mockResolvedValue({ id: 't1' });
    prisma.emailTemplate.update.mockResolvedValue({ id: 't1', isActive: false });

    await handler.execute({ id: 't1', isActive: false });
    expect(prisma.emailTemplate.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { isActive: false },
    });
  });
});
