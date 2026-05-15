import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListEmailTemplatesHandler } from './list-email-templates.handler';

describe('ListEmailTemplatesHandler', () => {
  let handler: ListEmailTemplatesHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListEmailTemplatesHandler,
        { provide: PrismaService, useValue: {
    emailTemplate: { findMany: jest.fn(), count: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<ListEmailTemplatesHandler>(ListEmailTemplatesHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.emailTemplate.findMany as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({page:1,limit:10});
    expect(result).toBeDefined();
  });
});
