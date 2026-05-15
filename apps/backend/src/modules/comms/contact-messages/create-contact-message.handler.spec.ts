import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CreateContactMessageHandler } from './create-contact-message.handler';

describe('CreateContactMessageHandler', () => {
  let handler: CreateContactMessageHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateContactMessageHandler,
        { provide: PrismaService, useValue: {
          contactMessage: { create: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<CreateContactMessageHandler>(CreateContactMessageHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should create contact message', async () => {
    (prisma.contactMessage.create as jest.Mock).mockResolvedValue({ id: 'test', createdAt: new Date(), status: 'PENDING' });
    await handler.execute({ phone: '+966501234567', email: 'test@example.com', name: 'Test', subject: 'test', body: 'test' });
    expect(prisma.contactMessage.create).toHaveBeenCalled();
  });

  it('should throw when no phone or email', async () => {
    await expect(handler.execute({ phone: undefined as any, email: undefined as any, name: 'Test', subject: 'test', body: 'test' })).rejects.toThrow();
  });
});
