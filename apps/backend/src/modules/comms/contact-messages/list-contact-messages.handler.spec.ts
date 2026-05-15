import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListContactMessagesHandler } from './list-contact-messages.handler';

describe('ListContactMessagesHandler', () => {
  let handler: ListContactMessagesHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListContactMessagesHandler,
        { provide: PrismaService, useValue: {
    contactMessage: { findMany: jest.fn(), count: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<ListContactMessagesHandler>(ListContactMessagesHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.contactMessage.findMany as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({status:"PENDING",page:1,limit:10});
    expect(result).toBeDefined();
  });
});
