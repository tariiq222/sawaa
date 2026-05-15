import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { PreviewEmailTemplateHandler } from './preview-email-template.handler';

describe('PreviewEmailTemplateHandler', () => {
  let handler: PreviewEmailTemplateHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreviewEmailTemplateHandler,
        { provide: PrismaService, useValue: {
          emailTemplate: { findFirst: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<PreviewEmailTemplateHandler>(PreviewEmailTemplateHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should preview with interpolation', async () => {
    (prisma.emailTemplate.findFirst as jest.Mock).mockResolvedValue({
      subject: 'Hello {{name}}',
      htmlBody: '<p>Hi {{name}}</p>',
    });
    const result = await handler.execute({ id: 't1', context: { name: 'World' } });
    expect(result.subject).toBe('Hello World');
    expect(result.body).toBe('<p>Hi World</p>');
  });

  it('should throw when template not found', async () => {
    (prisma.emailTemplate.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ id: 't1', context: {} })).rejects.toThrow();
  });
});
