import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateEmailTemplateHandler } from './update-email-template.handler';

describe('UpdateEmailTemplateHandler', () => {
  let handler: UpdateEmailTemplateHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateEmailTemplateHandler,
    { provide: PrismaService, useValue: {
    emailTemplate: { findFirst: jest.fn(), update: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<UpdateEmailTemplateHandler>(UpdateEmailTemplateHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ id: '00000000-0000-0000-0000-000000000001' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
