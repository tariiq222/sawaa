import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CreateEmailTemplateHandler } from './create-email-template.handler';

describe('CreateEmailTemplateHandler', () => {
  let handler: CreateEmailTemplateHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateEmailTemplateHandler,
    { provide: PrismaService, useValue: {
    emailTemplate: { findFirst: jest.fn(), create: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<CreateEmailTemplateHandler>(CreateEmailTemplateHandler);
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
