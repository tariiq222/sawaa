import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateContactMessageStatusHandler } from './update-contact-message-status.handler';

describe('UpdateContactMessageStatusHandler', () => {
  let handler: UpdateContactMessageStatusHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateContactMessageStatusHandler,
        { provide: PrismaService, useValue: {
    contactMessage: { findFirst: jest.fn(), update: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<UpdateContactMessageStatusHandler>(UpdateContactMessageStatusHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.contactMessage.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({id:"00000000-0000-0000-0000-000000000001",status:"PENDING"});
    
    (prisma.contactMessage.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({id:"00000000-0000-0000-0000-000000000001",status:"PENDING"})).rejects.toThrow();
  });
});
