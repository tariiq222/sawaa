import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateEmailTemplateHandler } from './create-email-template.handler';
import { PrismaService } from '../../../infrastructure/database';

jest.mock('./render-blocks', () => ({
  renderBlocksToHtml: jest.fn().mockReturnValue('<html>rendered</html>'),
}));

describe('CreateEmailTemplateHandler', () => {
  let handler: CreateEmailTemplateHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = { emailTemplate: { findFirst: jest.fn(), create: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CreateEmailTemplateHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<CreateEmailTemplateHandler>(CreateEmailTemplateHandler);
  });

  it('should throw ConflictException when slug exists', async () => {
    prisma.emailTemplate.findFirst.mockResolvedValue({ id: 't1', slug: 'welcome' });
    await expect(handler.execute({ slug: 'welcome', name: 'Welcome', subject: 'Welcome' })).rejects.toThrow(ConflictException);
  });

  it('should create template with htmlBody', async () => {
    prisma.emailTemplate.findFirst.mockResolvedValue(null);
    prisma.emailTemplate.create.mockResolvedValue({ id: 't1', slug: 'welcome' });

    const result = await handler.execute({ slug: 'welcome', name: 'Welcome', subject: 'Welcome', htmlBody: '<p>Hi</p>' });
    expect(prisma.emailTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ htmlBody: '<p>Hi</p>', blocks: undefined }),
    }));
    expect(result.id).toBe('t1');
  });

  it('should create template with blocks and render htmlBody', async () => {
    prisma.emailTemplate.findFirst.mockResolvedValue(null);
    prisma.emailTemplate.create.mockResolvedValue({ id: 't2', slug: 'reset' });

    await handler.execute({ slug: 'reset', name: 'Reset', subject: 'Reset', blocks: [{ type: 'text', content: 'hello' }] as any });
    expect(prisma.emailTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ htmlBody: '<html>rendered</html>', blocks: [{ type: 'text', content: 'hello' }] }),
    }));
  });
});
