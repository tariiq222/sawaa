import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetEmailTemplateHandler } from './get-email-template.handler';

describe('GetEmailTemplateHandler', () => {
  let handler: GetEmailTemplateHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetEmailTemplateHandler,
        {
          provide: PrismaService,
          useValue: {
            emailTemplate: { findFirst: jest.fn() },
          },
        },
      ],
    }).compile();

    handler = module.get<GetEmailTemplateHandler>(GetEmailTemplateHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should return template', async () => {
    (prisma.emailTemplate.findFirst as jest.Mock).mockResolvedValue({ id: 't1', subject: 'Test' });
    const result = await handler.execute({ id: 't1' });
    expect(result).toBeDefined();
    expect(result?.subject).toBe('Test');
  });

  it('should return null when not found', async () => {
    (prisma.emailTemplate.findFirst as jest.Mock).mockResolvedValue(null);
    const result = await handler.execute({ id: 't1' });
    expect(result).toBeNull();
  });
});
